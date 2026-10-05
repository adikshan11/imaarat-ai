import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = new URL('../src/components/shared/select_keys.ts', import.meta.url)
const helpers = existsSync(source)
  ? await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`)
  : { selectKey: () => null, placeMenu: () => null }
const { selectKey, placeMenu } = helpers
const names = ['Accept', 'Auto-Decline', 'Decline (mitigation possible)', 'Refer']
const closed = { open: false, active: 2, search: '', typedAt: 0 }
const opened = { ...closed, open: true }

test('opening keeps the committed value', () => {
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    assert.deepEqual(selectKey(closed, key, names, 2, 100), { ...closed, open: true, commit: null, prevent: true })
  }
  assert.equal(selectKey(closed, 'ArrowUp', names, 2, 100)?.active, 0)
})

test('navigation clamps and supports endpoints and pages', () => {
  assert.equal(selectKey(opened, 'ArrowDown', names, 2, 100)?.active, 3)
  assert.equal(selectKey({ ...opened, active: 3 }, 'ArrowDown', names, 2, 100)?.active, 3)
  assert.equal(selectKey({ ...opened, active: 0 }, 'ArrowUp', names, 2, 100)?.active, 0)
  for (const key of ['Home', 'PageUp']) assert.equal(selectKey(opened, key, names, 2, 100)?.active, 0)
  for (const key of ['End', 'PageDown']) assert.equal(selectKey(opened, key, names, 2, 100)?.active, 3)
})

test('commit and escape differ, tab retains default focus movement', () => {
  for (const key of ['Enter', ' ', 'Tab']) {
    const result = selectKey(opened, key, names, 0, 100)
    assert.equal(result?.commit, 2)
    assert.equal(result?.open, false)
    assert.equal(result?.prevent, key !== 'Tab')
  }
  assert.equal(selectKey(opened, 'Escape', names, 0, 100)?.commit, null)
  assert.equal(selectKey(closed, 'Tab', names, 0, 100)?.prevent, false)
})

test('typeahead supports phrases, repeated letters and timeout', () => {
  const first = selectKey(closed, 'a', names, 2, 100)
  assert.equal(first?.active, 0)
  assert.equal(selectKey(first, 'a', names, 2, 200)?.active, 1)
  assert.equal(selectKey(first, 'u', names, 2, 200)?.active, 1)
  assert.equal(selectKey(first, 'r', names, 2, 1500)?.active, 3)
  assert.equal(selectKey(first, 'z', names, 2, 200)?.active, 0)
  assert.equal(selectKey(closed, 'ض', ['قبول', 'رفض', 'ضمان'], 0, 100)?.active, 2)
})

test('empty options and non-navigation keys are safe', () => {
  assert.equal(selectKey(closed, 'ArrowDown', [], -1, 100)?.open, false)
  assert.equal(selectKey(opened, 'Shift', names, 2, 100)?.prevent, false)
})

test('popup flips at bottom and aligns RTL inside viewport', () => {
  assert.deepEqual(placeMenu({ left: 100, right: 300, top: 500, bottom: 544, width: 200 }, 800, 600, 180, false), { left: 100, top: 314, width: 200, maxHeight: 180 })
  assert.deepEqual(placeMenu({ left: 4, right: 104, top: 10, bottom: 54, width: 100 }, 320, 600, 180, true), { left: 8, top: 60, width: 180, maxHeight: 180 })
})

test('popup bounds narrow screens and available height', () => {
  const result = placeMenu({ left: 180, right: 390, top: 160, bottom: 204, width: 210 }, 240, 260, 280, false)
  assert.ok(result)
  assert.ok(result.left >= 8)
  assert.ok(result.left + result.width <= 232)
  assert.ok(result.top >= 8)
  assert.ok(result.top + result.maxHeight <= 252)
})