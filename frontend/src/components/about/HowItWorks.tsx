import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'

const STEPS = ['s1', 's2', 's3', 's4']
const DIFFERENT = ['d1', 'd2', 'd3']

const SOURCES = [
  { name: 'Cotality · Property underwriting and human oversight · 3 June 2026', href: 'https://www.cotality.com/insights/articles/how-ai-in-insurance-underwriting-transforms-insurance-workflows' },
  { name: 'Google · Gemini API data-use terms · 28 April 2026', href: 'https://ai.google.dev/gemini-api/terms' },
  { name: 'IRDAI · AI governance working-group order · 17 June 2026', href: 'https://irdai.gov.in/orders1' },
]

export default function HowItWorks() {
  const { t } = usePreferences()
  return (
    <div>
      <div className="page-subtitle">{t('how.eyebrow')}</div>
      <h1 className="page-title">{t('how.title')}</h1>
      <p className="page-lead">{t('how.lead')}</p>

      <ol className="how-steps">
        {STEPS.map((step) => (
          <li key={step} className="card how-step">
            <h3 className="card-title">{t(`how.${step}.title`)}</h3>
            <p>{t(`how.${step}.body`)}</p>
          </li>
        ))}
      </ol>

      <div className="dashboard-grid">
        <Card title={t('how.different')}>
          <ul className="how-list">{DIFFERENT.map((item) => <li key={item}>{t(`how.${item}`)}</li>)}</ul>
        </Card>
        <Card title={t('how.regulation')}>
          <ul className="how-list">{['r1', 'r2'].map((key) => <li key={key}>{t(`how.${key}`)}</li>)}</ul>
        </Card>
      </div>

      <Card title={t('how.industry')}>
        <p className="card-footnote">{t('how.industry_note')}</p>
        <ul className="how-list how-sources" lang="en">
          {SOURCES.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.name}</a></li>)}
        </ul>
      </Card>
    </div>
  )
}
