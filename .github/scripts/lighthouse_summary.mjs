import { readFileSync } from 'node:fs'

const metrics = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index']
const rows = process.argv.slice(2).map((path) => {
  const report = JSON.parse(readFileSync(path, 'utf8'))
  const scores = Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, Math.round(category.score * 100)]))
  const values = Object.fromEntries(metrics.map((key) => [key, report.audits[key]?.displayValue ?? 'n/a']))
  const opportunities = Object.values(report.audits).filter((audit) => audit.details?.type === 'opportunity' && (audit.details.overallSavingsMs ?? 0) > 100).map((audit) => `${audit.title} (${Math.round(audit.details.overallSavingsMs)} ms)`)
  return { formFactor: report.configSettings.formFactor, scores, values, opportunities, fetchTime: report.fetchTime }
})
console.log(`## Lighthouse ${rows[0]?.fetchTime ?? ''}\n`)
console.log('| Device | Performance | Accessibility | Best practices | SEO | ' + metrics.join(' | ') + ' |')
console.log('|' + ' --- |'.repeat(5 + metrics.length))
for (const row of rows) console.log(`| ${row.formFactor} | ${row.scores.performance} | ${row.scores.accessibility} | ${row.scores['best-practices']} | ${row.scores.seo} | ` + metrics.map((key) => row.values[key]).join(' | ') + ' |')
for (const row of rows) if (row.opportunities.length) console.log(`\n**${row.formFactor} opportunities:** ${row.opportunities.join('; ')}`)
