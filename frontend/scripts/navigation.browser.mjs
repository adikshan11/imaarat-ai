import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const load = createRequire(join(process.env.PLAYWRIGHT_PATH ?? root, 'package.json'))
const { chromium } = (() => {
  try {
    return load('playwright')
  } catch {
    return load('playwright-core')
  }
})()

const port = process.env.PREVIEW_PORT ?? '4310'
process.env.APP_URL = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root, stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)

const ready = async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${process.env.APP_URL}/`)).ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error('preview server did not start')
}

const { verifyAccount, verifyCompletion, verifyDesktop, verifyLabels, verifyNavigation, verifySignIn, verifyTouch } = await import('./navigation_browser.mjs')
const checks = [
  { name: 'verifySignIn', run: verifySignIn, touch: false, fresh: true },
  { name: 'verifyAccount', run: verifyAccount, touch: false, fresh: true },
  { name: 'verifyNavigation', run: verifyNavigation, touch: false },
  { name: 'verifyLabels', run: verifyLabels, touch: false },
  { name: 'verifyDesktop', run: verifyDesktop, touch: false },
  { name: 'verifyTouch', run: verifyTouch, touch: true, open: true },
  { name: 'verifyCompletion', run: verifyCompletion, touch: false },
]
let failed = 0
try {
  await ready()
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
  const demo = async (options) => {
    const context = await browser.newContext(options)
    await context.addInitScript(() => sessionStorage.setItem('imaarat.demo', '1'))
    return context.newPage()
  }
  const shared = await demo()
  for (const check of checks) {
    const page = check.fresh ? await (await browser.newContext()).newPage() : check.touch || check.name === 'verifyCompletion' ? await demo({ hasTouch: check.touch, viewport: check.touch ? { width: 390, height: 844 } : undefined }) : shared
    try {
      if (check.open) await page.goto(`${process.env.APP_URL}/app/`)
      await check.run(page)
      console.log(`ok ${check.name}`)
    } catch (error) {
      failed++
      console.error(`not ok ${check.name}: ${error instanceof Error ? error.message : error}`)
    }
  }
  await browser.close()
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
