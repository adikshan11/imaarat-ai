import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import https from 'node:https'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PATH, 'node_modules/playwright/index.mjs')).href)
const root = resolve('dist')
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = https.createServer({ key: await readFile(process.env.BROWSER_TEST_KEY), cert: await readFile(process.env.BROWSER_TEST_CERT) }, async (request, response) => {
  try {
    const url = new URL(request.url, 'https://127.0.0.1')
    const filename = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!filename.startsWith(root + sep)) throw new Error('path invalid')
    const body = await readFile(filename)
    response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream' })
    response.end(body)
  } catch { response.writeHead(404); response.end() }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const origin = `https://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true, locale: 'en-US' })
    const page = await context.newPage()
    const output = []
    page.on('console', (message) => output.push(message.text()))
    const csrf = 'a'.repeat(64)
    const owner = '00000000-0000-4000-8000-000000000001'
    const keyCanary = 'browser-test-credential-canary'
    const tokenCanary = 'T'.repeat(43)
    let session = true
    let failCreate = true
    let rows = []
    let tokenRows = []
    const calls = []
    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      calls.push({ url: url.href, method: request.method(), body: request.postData(), csrf: request.headers()['x-csrf-token'] })
      const reply = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) })
      if (url.pathname === '/api/status') return reply({ ai: false, ready: false, persistent_storage: true })
      if (url.pathname === '/api/auth/session') return session ? reply({ owner_id: owner, role: 'member', data_policy: 'private_local', csrf_token: csrf, expires_at: Math.floor(Date.now() / 1000) + 1800 }) : reply({}, 401)
      if (url.pathname === '/api/auth/logout') { session = false; return route.fulfill({ status: 204 }) }
      if (!session) return reply({}, 401)
      if (url.pathname === '/api/underwrite/history') return reply([])
      if (url.pathname === '/api/connections' && request.method() === 'POST') {
        assert.equal(request.headers()['x-csrf-token'], csrf)
        assert.equal(JSON.parse(request.postData()).credential, keyCanary)
        if (failCreate) return reply({ detail: keyCanary }, 503)
        rows = [{ id: '00000000-0000-4000-8000-000000000002', owner_id: owner, provider: 'gemini', suffix: 'nary', state: 'unverified', version: 1 }]
        return reply(rows[0], 201)
      }
      if (url.pathname === '/api/connections') return reply(rows)
      if (url.pathname === '/api/auth/tokens' && request.method() === 'POST') {
        tokenRows = [{ id: '00000000-0000-4000-8000-000000000003', scopes: ['interop:read'], expires_at: Math.floor(Date.now() / 1000) + 3600 }]
        return reply({ ...tokenRows[0], token: tokenCanary }, 201)
      }
      if (url.pathname === '/api/auth/tokens') return reply(tokenRows)
      return reply({}, 503)
    })
    await page.goto(origin)
    await page.getByRole('button', { name: 'Account and connections' }).click()
    await page.getByRole('button', { name: 'Re-authenticate with GitHub' }).waitFor()
    await page.getByLabel('Provider credential', { exact: true }).fill(keyCanary)
    await page.getByRole('button', { name: 'Store in private broker' }).click()
    await page.getByText('The secure service is unavailable. No alternate service was used.', { exact: true }).waitFor()
    assert.equal(await page.locator('#account-credential').inputValue(), '')
    assert.equal((await page.locator('body').innerText()).includes(keyCanary), false)
    failCreate = false
    await page.locator('#account-credential').fill(keyCanary)
    await page.getByRole('button', { name: 'Store in private broker' }).click()
    await page.getByText('Stored as unverified metadata. No AI provider was activated.', { exact: true }).waitFor()
    assert.equal(await page.locator('#account-credential').inputValue(), '')
    await page.getByRole('button', { name: 'Create one-hour read token' }).click()
    await page.locator('#issued-token').waitFor()
    assert.equal(await page.locator('#issued-token').inputValue(), tokenCanary)
    const checked = page.waitForResponse(origin + '/api/auth/session')
    await page.getByRole('button', { name: 'Check session', exact: true }).click()
    await checked
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Check session')?.disabled)
    assert.equal(await page.locator('#issued-token').inputValue(), tokenCanary)
    assert.equal(await page.evaluate((canaries) => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }).includes(canaries[0]) || JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }).includes(canaries[1]), [keyCanary, tokenCanary]), false)
    assert.equal(output.some((line) => line.includes(keyCanary) || line.includes(tokenCanary)), false)
    assert.equal(calls.some((call) => call.url.includes(keyCanary) || call.url.includes(tokenCanary)), false)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('button', { name: 'Start synthetic guest session' }).waitFor()
    assert.equal(await page.locator('#issued-token').count(), 0)
    assert.equal(await page.locator('#account-credential').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await context.close()
    console.log(`Account browser contract passed at ${viewport.width}px; isolated test API only.`)
  }
} finally {
  await browser.close()
  await new Promise((done) => server.close(done))
}