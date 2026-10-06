import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function run(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })

  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('TypeScript', [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-b'])
run('Vite', [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'])
run('Prerender', [join(root, 'scripts', 'prerender.mjs')])
