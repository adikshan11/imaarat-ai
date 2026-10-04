import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const result = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-b'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
})

if (result.error) {
  console.error(`TypeScript failed to start: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
