import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = new URL('../src/components/layout/nav_motion.ts', import.meta.url)
const helpers = existsSync(source)
  ? await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`)
  : { navKey: () => null, navPoint: () => null }

test('keys move focus in visual direction and clamp endpoints', () => {
  assert.equal(helpers.navKey('ArrowRight', 1, 4, false), 2)
  assert.equal(helpers.navKey('ArrowRight', 1, 4, true), 0)
  assert.equal(helpers.navKey('ArrowLeft', 1, 4, true), 2)
  assert.equal(helpers.navKey('Home', 2, 6, true), 0)
  assert.equal(helpers.navKey('End', 2, 6, false), 5)
  assert.equal(helpers.navKey('ArrowLeft', 0, 4, false), 0)
  assert.equal(helpers.navKey('ArrowRight', 3, 4, false), 3)
  assert.equal(helpers.navKey('Tab', 2, 4, false), null)
})

test('scrub chooses actual unequal bounds in either direction', () => {
  const bounds = [{ left: 10, right: 100 }, { left: 102, right: 162 }, { left: 164, right: 224 }, { left: 226, right: 286 }]
  assert.equal(helpers.navPoint(-40, bounds), 0)
  assert.equal(helpers.navPoint(400, bounds), 3)
  assert.equal(helpers.navPoint(140, bounds), 1)
  assert.equal(helpers.navPoint(140, [...bounds].reverse()), 2)
  assert.equal(helpers.navPoint(400, [...bounds].reverse()), 0)
  assert.equal(helpers.navPoint(30, []), -1)
})