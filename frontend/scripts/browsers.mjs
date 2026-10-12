import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { glassState, tabProblem, tabShape } from './navigation_browser.mjs'

const playwright = createRequire(join(process.env.PLAYWRIGHT_PATH, 'package.json'))('playwright')
const site = new URL(process.env.SITE.trim().split(/\s+/)[0]).origin
const headers = process.env.BYPASS ? { 'x-vercel-protection-bypass': process.env.BYPASS } : {}
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } }
const rows = []
let failed = 0

async function headerTone(page, dark) {
  await page.evaluate((dark) => {
    const section = document.querySelectorAll('[data-dark]')[1]
    const target = dark ? section : section.nextElementSibling
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + 40, behavior: 'instant' })
  }, dark)
  await page.waitForTimeout(800)
  return page.evaluate(() => {
    const header = document.querySelector('.site-header')
    const middle = header.offsetHeight / 2
    const under = [...document.querySelectorAll('[data-dark]')].some((section) => section.getBoundingClientRect().top <= middle && section.getBoundingClientRect().bottom > middle)
    return header.dataset.tone === (under ? 'dark' : 'light') ? header.dataset.tone : `${header.dataset.tone} (expected ${under ? 'dark' : 'light'} at ${Math.round(window.scrollY)})`
  })
}

await mkdir('browsers', { recursive: true })
for (const name of ['chromium', 'firefox', 'webkit']) {
  const browser = await playwright[name].launch()
  for (const [label, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport, extraHTTPHeaders: headers })
    await page.goto(`${site}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const glass = await glassState(page)
    await page.screenshot({ path: `browsers/${name}-${label}-home.png` })
    const overDark = await headerTone(page, true)
    await page.screenshot({ path: `browsers/${name}-${label}-header-dark.png`, clip: { x: 0, y: 0, width: viewport.width, height: 160 } })
    const overLight = await headerTone(page, false)
    const toneWrong = overDark !== 'dark' || overLight !== 'light'
    if (toneWrong) failed++
    await page.goto(`${site}/app/?demo#how`, { waitUntil: 'networkidle' })
    await page.locator('[aria-current="page"]:visible').first().waitFor()
    await page.waitForTimeout(500)
    const shape = label === 'phone' ? await tabShape(page) : null
    const broken = shape !== null && tabProblem(shape)
    if (broken) failed++
    await page.screenshot({ path: `browsers/${name}-${label}-app.png` })
    rows.push(`| ${name} | ${label} | ${glass.lens ? 'refraction' : `fallback (${glass.backdrop})`} | ${toneWrong ? 'FAIL' : 'ok'}: ${overDark} over dark, ${overLight} over light | ${shape ? `${broken ? 'FAIL' : 'ok'}: fit ${shape.fit.toFixed(1)} px, edge ${shape.edgeGap.toFixed(1)} px, rim ${shape.rim}, separators ${shape.separators ? 'present' : 'none'}, lens ${shape.lens ? 'refraction' : 'blur'}` : 'sidebar'} |`)
    await page.close()
  }
  await browser.close()
}
console.log(`### Browsers on ${site}\n\n| Browser | Viewport | Home glass | Header tone | Tab bar |\n|---|---|---|---|---|\n${rows.join('\n')}`)
process.exit(failed ? 1 : 0)
