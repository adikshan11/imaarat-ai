import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('public explanation avoids developer terminology and unsupported claims', async () => {
  const strings = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'))
  const steps = ['lead', 's1.body', 's2.body', 's3.body', 's4.body', 'd1', 'd2', 'd3']
  for (const key of steps) {
    assert.doesNotMatch(strings[`how.${key}`], /MCP|A2A|Gemini|rule engine|official|published evaluations/i)
  }
  assert.match(strings['how.d3'], /prototype/i)
  assert.match(strings['how.r2'], /English/i)
})

test('brand and favicon share a font-independent mark', async () => {
  const favicon = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
  const brand = await readFile(new URL('../src/components/layout/Brand.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(favicon, /<text\b|font-family/i)
  assert.match(favicon, /<path\b/)
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const source = brand.match(/src="([^"]+)"/)?.[1]
  assert.match(source ?? '', /^\/favicon\.svg\?v=/)
  assert.ok(html.includes(`href="${source}"`))
})

test('navigation uses shared alignment and separate mobile captions', async () => {
  const sidebar = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const controls = await readFile(new URL('../src/components/layout/Controls.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(sidebar, /OpticalLabel/)
  assert.match(controls, /OpticalLabel/)
  assert.match(sidebar, /nav\.mobile\./)
  assert.match(sidebar, /aria-label=\{caption === item\.text \? item\.text : `\$\{caption\} — \$\{item\.text\}`\}/)
  assert.match(css, /--nav-glass/)
  assert.match(css, /prefers-reduced-transparency/)
})

test('floating navigation is centered with restrained highlights and readable captions', async () => {
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  const bar = css.match(/\.tabbar \{ position: fixed;[^}]+\}/)?.[0] ?? ''
  assert.match(bar, /width: min\(calc\(100% - 32px\), 440px\)/)
  assert.match(bar, /margin-inline: auto/)
  assert.match(bar, /bottom: calc\(14px \+ env\(safe-area-inset-bottom, 0px\)\)/)
  assert.doesNotMatch(bar, /inset 0 1\.5px/)
  assert.match(css, /\.tab-item \{[^}]*font-size: 14px/)
  assert.match(css, /\.tab-caption \{[^}]*align-items: center/)
})