import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/quality/AIQuality.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const module = { exports: {} }
const imports = (name) => {
  if (name.endsWith('.css')) return {}
  if (name === '@/components/shared/Card') return { __esModule: true, default: ({ title, children }) => React.createElement('section', null, title, children) }
  if (name === '@/context/Preferences') return { usePreferences: () => ({ t: (key) => key }) }
  if (name === '@/api/underwriting') return { fetchEvals: async () => null }
  return require(name)
}
new Function('require', 'module', 'exports', compiled)(imports, module, module.exports)
const render = (report) => renderToStaticMarkup(React.createElement(module.exports.QualityResults ?? module.exports.default, { report }))

test('null and absent report fields render honestly', () => {
  for (const report of [null, {}, { deterministic: null, generated_at: null }, { memos: {} }]) {
    const html = render(report)
    assert.match(html, /Not run|not_run/)
    assert.doesNotMatch(html, /NaN|undefined|100%/)
  }
})

test('deterministic results are not labelled LLM accuracy', () => {
  const html = render({ run_mode: 'deterministic_only', deterministic: { cases: 24, accuracy: 1 }, sections: { memos: { status: 'skipped', reason: 'live_not_requested' } } })
  assert.match(html, /24/)
  assert.match(html, /synthetic/)
  assert.match(html, /not LLM accuracy/)
  assert.match(html, /skipped/)
})

test('false pass and failed denominators remain visible', () => {
  const html = render({ status: 'failed', passed: false, memos: { toon: { memos: 2, failed: 1, faithfulness_cases: 1, faithfulness: 0.8 }, rows: [{ id: 'sample', format: 'toon', status: 'failed', reason: 'judge_failed' }] } })
  assert.match(html, /Failed/)
  assert.match(html, /judge_failed/)
  assert.match(html, /1 \/ 2/)
  assert.match(html, /exclude failed/)
})

test('retrieval criteria and generation attempts are explicit', () => {
  const html = render({ passed: false, retrieval: { hit_rate: 0, recall: 0, mrr: 0, passed: false, thresholds: { hit_rate: 1, recall: 0.75 } }, metadata: { retrieval_acceptance: 'At least one expected guideline per synthetic case; not industry certification.' }, memos: { toon: { memos: 2, generation_attempts: 1, faithfulness_cases: 1, failed: 1 } } })
  assert.match(html, /Hit-rate threshold: 100%/)
  assert.match(html, /Recall threshold: 75%/)
  assert.match(html, /Retrieval check: Failed/)
  assert.match(html, /not industry certification/)
  assert.match(html, /Generation attempts/)
  assert.match(html, /planned case-format slots/)
})