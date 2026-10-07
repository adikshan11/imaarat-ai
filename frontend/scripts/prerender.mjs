import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const pages = { 'index.html': 'landing', 'privacy/index.html': 'privacy', 'terms/index.html': 'terms', 'changelog/index.html': 'changelog' }
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { render } = await vite.ssrLoadModule('/src/landing/render.tsx')
  for (const [file, name] of Object.entries(pages)) {
    const page = fileURLToPath(new URL(`../dist/${file}`, import.meta.url))
    const html = await readFile(page, 'utf8')
    if (!html.includes('<!--landing-->')) throw new Error(`dist/${file} has no <!--landing--> placeholder`)
    await writeFile(page, html.replace('<!--landing-->', render(name)))
    console.log(`Prerendered ${name} into dist/${file}`)
  }
} finally {
  await vite.close()
}
