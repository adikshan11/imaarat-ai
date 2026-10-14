import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'i18n', 'locales')
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')

const english = read('en.json')
let failed = 0
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'en.json')) {
  const messages = read(file)
  const problems = [
    ...Object.keys(english).filter((key) => !(key in messages)).map((key) => `missing ${key}`),
    ...Object.keys(messages).filter((key) => !(key in english)).map((key) => `extra ${key}`),
    ...Object.keys(english).filter((key) => key in messages && placeholders(english[key]) !== placeholders(messages[key])).map((key) => `placeholder ${key}`),
    ...Object.keys(messages).filter((key) => !String(messages[key]).trim()).map((key) => `empty ${key}`),
  ]
  if (problems.length) {
    failed += 1
    console.error(`${file}: ${problems.slice(0, 10).join('; ')}`)
  }
}
const copy = join(dirname(dir), '..', 'landing', 'copy')
const source = JSON.parse(readFileSync(join(copy, 'source.json'), 'utf8'))
for (const file of readdirSync(join(copy, 'dictionaries')).filter((name) => name.endsWith('.json'))) {
  const words = JSON.parse(readFileSync(join(copy, 'dictionaries', file), 'utf8'))
  const problems = [
    ...source.filter((text) => !String(words[text] ?? '').trim()).map((text) => `missing ${text.slice(0, 40)}`),
    ...Object.keys(words).filter((text) => !source.includes(text)).map((text) => `extra ${text.slice(0, 40)}`),
  ]
  if (problems.length) {
    failed += 1
    console.error(`landing ${file}: ${problems.slice(0, 10).join('; ')}`)
  }
}
console.log(failed ? `${failed} locale file(s) failed` : 'All locale files match en.json')
process.exit(failed ? 1 : 0)
