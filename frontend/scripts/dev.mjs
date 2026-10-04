import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const child = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
})

child.on('error', (error) => {
  console.error(`Vite failed to start: ${error.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
