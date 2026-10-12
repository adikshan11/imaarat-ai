import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const playwright = createRequire(join(process.env.PLAYWRIGHT_PATH, 'package.json'))('playwright')
const site = new URL(process.env.SITE.trim().split(/\s+/)[0]).origin
const headers = process.env.BYPASS ? { 'x-vercel-protection-bypass': process.env.BYPASS } : {}
const browser = await playwright.chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce', extraHTTPHeaders: headers })
const canvas = await browser.newPage()
await mkdir('screenshots', { recursive: true })

async function save(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1000)
  const png = (await page.screenshot()).toString('base64')
  for (const width of [1440, 720]) {
    const webp = await canvas.evaluate(async ({ png, width }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const board = document.createElement('canvas')
      board.width = width
      board.height = Math.round((image.height * width) / image.width)
      const context = board.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, board.width, board.height)
      return board.toDataURL('image/webp', 0.82).split(',')[1]
    }, { png, width })
    await writeFile(`screenshots/shot-${name}-${width}.webp`, Buffer.from(webp, 'base64'))
  }
  console.log(`shot-${name}`)
}

async function open(view) {
  await page.goto(`${site}/app/#${view}`)
  await page.reload({ waitUntil: 'networkidle' })
}

await page.goto(`${site}/app/?demo`, { waitUntil: 'networkidle' })
const rows = page.locator('tbody tr')
await rows.first().waitFor()
await save('dashboard')
const tidel = rows.filter({ hasText: 'TIDEL' })
await ((await tidel.count()) ? tidel : rows).first().getByRole('button').first().click()
await page.waitForLoadState('networkidle')
await save('result')
await open('paper')
await save('paper')
await open('status')
await page.locator('.ops-bars').first().waitFor()
await save('status')
await browser.close()
