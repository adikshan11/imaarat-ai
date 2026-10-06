import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
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

const [casesPath, outDir] = process.argv.slice(2)
const cases = JSON.parse(readFileSync(casesPath, 'utf8'))
const choices = {
  construction_type: ['Frame', 'Joisted Masonry', 'Non-Combustible', 'Masonry Non-Combustible', 'Fire Resistive'],
  cat_zone: ['None', 'Wind', 'Hail', 'Wildfire', 'Flood', 'Earthquake'],
  seismic_zone: ['II', 'III', 'IV', 'V'],
  sprinkler_system: ['yes', 'no'],
  fire_alarm: ['yes', 'no'],
  flood_protection: ['yes', 'no'],
}
mkdirSync(outDir, { recursive: true })
const port = process.env.PREVIEW_PORT ?? '4350'
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root, stdio: 'ignore' })
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    if ((await fetch(`${base}/`)).ok) break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
try {
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 2 })
    await context.addInitScript((lang) => { localStorage.setItem('imaarat.lang', lang) }, item.lang)
    const page = await context.newPage()
    await page.goto(`${base}/?form=${item.id}#paper`)
    await page.emulateMedia({ media: 'print' })
    await page.waitForSelector('.print-area [data-field="zip"]', { state: 'visible' })
    await page.evaluate(async ({ values, font, choices, seed }) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${font.replaceAll(' ', '+')}&display=block`
      document.head.appendChild(link)
      await new Promise((resolve) => { link.onload = resolve; link.onerror = resolve })
      let state = seed
      const jitter = () => {
        state = (state * 9301 + 49297) % 233280
        return state / 233280 - 0.5
      }
      const ink = (text) => {
        const span = document.createElement('span')
        span.textContent = text
        span.style.cssText = `font-family:'${font}',cursive;font-size:15pt;color:#1d2f8f;display:inline-block;padding:1mm 2mm;transform:rotate(${jitter() * 3}deg) translateY(${jitter() * 2}px)`
        return span
      }
      for (const [name, value] of Object.entries(values)) {
        const field = document.querySelector(`.print-area [data-field="${name}"]`)
        if (!field || value === '') continue
        if (choices[name]) {
          const box = field.querySelectorAll('.pf-ticks i')[choices[name].indexOf(value)]
          if (box) {
            box.textContent = '✓'
            box.style.cssText = `font:700 14pt '${font}',cursive;color:#1d2f8f;line-height:4mm;text-align:center;transform:rotate(${jitter() * 12}deg)`
          }
        } else if (field.querySelector('.pf-cells')) {
          field.querySelectorAll('.pf-cells span').forEach((cell, index) => {
            cell.style.display = 'grid'
            cell.style.placeItems = 'center'
            if (value[index]) cell.appendChild(ink(value[index]))
          })
        } else {
          field.querySelector('.pf-box')?.appendChild(ink(value))
        }
      }
      await document.fonts.load(`15pt '${font}'`, Object.values(values).join(' '))
      await document.fonts.ready
      const area = document.querySelector('.print-area')
      area.style.cssText += `;background:linear-gradient(${110 + jitter() * 40}deg,#fff 0%,#f4f1ea 55%,#e9e5dc 100%);transform:rotate(${jitter() * 2.4}deg);filter:blur(0.35px) contrast(1.05) brightness(0.98);padding:6mm`
    }, { values: item.values, font: item.font, choices, seed: item.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) })
    await page.waitForTimeout(300)
    await page.locator('.print-area .pf-page').first().screenshot({ path: join(outDir, `${item.id}.jpg`), type: 'jpeg', quality: 82 })
    await context.close()
    console.log(`rendered ${item.id}`)
  }
} finally {
  await browser.close()
  server.kill()
}
