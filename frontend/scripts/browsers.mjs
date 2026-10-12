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
await mkdir('browsers', { recursive: true })
for (const name of ['chromium', 'firefox', 'webkit']) {
  const browser = await playwright[name].launch()
  for (const [label, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport, extraHTTPHeaders: headers })
    await page.goto(`${site}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const glass = await glassState(page)
    await page.screenshot({ path: `browsers/${name}-${label}-home.png` })
    await page.goto(`${site}/app/?demo#how`, { waitUntil: 'networkidle' })
    await page.locator('[aria-current="page"]:visible').first().waitFor()
    await page.waitForTimeout(500)
    const shape = label === 'phone' ? await tabShape(page) : null
    const broken = shape !== null && tabProblem(shape)
    if (broken) failed++
    await page.screenshot({ path: `browsers/${name}-${label}-app.png` })
    rows.push(`| ${name} | ${label} | ${glass.lens ? 'refraction' : `fallback (${glass.backdrop})`} | ${shape ? `${broken ? 'FAIL' : 'ok'}: fit ${shape.fit.toFixed(1)} px, edge ${shape.edgeGap.toFixed(1)} px, rim ${shape.rim}, separators ${shape.separators ? 'present' : 'none'}, lens ${shape.lens ? 'refraction' : 'blur'}` : 'sidebar'} |`)
    await page.close()
  }
  await browser.close()
}
console.log(`### Browsers on ${site}\n\n| Browser | Viewport | Home glass | Tab bar |\n|---|---|---|---|\n${rows.join('\n')}`)
process.exit(failed ? 1 : 0)
