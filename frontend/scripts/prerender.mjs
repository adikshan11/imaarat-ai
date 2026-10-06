import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const page = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { render } = await vite.ssrLoadModule('/src/landing/render.tsx')
  const html = await readFile(page, 'utf8')
  if (!html.includes('<!--landing-->')) throw new Error('dist/index.html has no <!--landing--> placeholder')
  await writeFile(page, html.replace('<!--landing-->', render()))
  console.log('Prerendered the landing page into dist/index.html')
} finally {
  await vite.close()
}
