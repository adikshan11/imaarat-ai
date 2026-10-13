import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'

const STEPS = ['s1', 's2', 's3', 's4']
const DIFFERENT = ['d1', 'd2', 'd3']

const SOURCES = [
  { name: 'IRDAI · Master circular on general insurance products · 11 June 2024', href: 'https://irdai.gov.in/documents/37343/991022/%E0%A4%B8%E0%A4%BE%E0%A4%A7%E0%A4%BE%E0%A4%B0%E0%A4%A3+%E0%A4%AC%E0%A5%80%E0%A4%AE%E0%A4%BE+%E0%A4%B5%E0%A5%8D%E0%A4%AF%E0%A4%B5%E0%A4%B8%E0%A4%BE%E0%A4%AF+%E0%A4%AA%E0%A4%B0+%E0%A4%AE%E0%A4%BE%E0%A4%B8%E0%A5%8D%E0%A4%9F%E0%A4%B0+%E0%A4%AA%E0%A4%B0%E0%A4%BF%E0%A4%AA%E0%A4%A4%E0%A5%8D%E0%A4%B0+-+%E0%A4%85%E0%A4%82%E0%A4%97%E0%A5%8D%E0%A4%B0%E0%A5%87%E0%A4%9C%E0%A5%80+_+Master+Circular+on+General+Insurance+Business+-+English.pdf/c00571ba-0b8e-bf5c-64a5-ee8d6f16fea9' },
  { name: 'IRDAI · Standard fire products for micro and small businesses and homes · 4 January 2021', href: 'https://irdai.gov.in/documents/37343/0/Guidelines+for+Standard+Products+for+Fire+and+Allied+Perils+_Bharat+Griha+Raksha%2C+Bharat+Sookshma+Udyam+Suraksha+and+Bharat+Laghu+Udyam+Suraksha.pdf/9f36d8b2-782b-eff6-01c8-3aa4a4c68c5b' },
  { name: 'IRDAI · AI governance working-group order · 17 June 2026', href: 'https://irdai.gov.in/orders1' },
  { name: 'Bureau of Indian Standards · National Building Code of India 2016', href: 'https://www.bis.gov.in/standards/national-building-code/?lang=en' },
  { name: 'NDMA · Floods', href: 'https://ndma.gov.in/floods' },
  { name: 'NDMA · Urban floods', href: 'https://ndma.gov.in/urban-floods' },
  { name: 'NDMA · Cyclone', href: 'https://ndma.gov.in/cyclone' },
  { name: 'NDMA · Earthquakes', href: 'https://ndma.gov.in/earthquakes' },
  { name: 'NDMA · Landslide', href: 'https://ndma.gov.in/landslide' },
  { name: 'Ministry of Earth Sciences · Seismic mapping, Lok Sabha reply · 30 July 2021', href: 'https://pib.gov.in/PressReleasePage.aspx?PRID=1740656' },
  { name: 'BMTPC · Vulnerability Atlas of India, third edition · 2 March 2019', href: 'https://bmtpc.org/topics.aspx?mid=56&Mid1=180' },
  { name: 'Central Water Commission · Flood forecasting and hydrological observation', href: 'https://cwc.gov.in/en/flood-forecasting-hydrological-observation' },
  { name: 'INCOIS · Storm surge, Indian Tsunami Early Warning System', href: 'https://tsunami.incois.gov.in/TEWS/AboutStormSurge.jsp' },
  { name: 'NRSC (ISRO) · Landslide Atlas of India · 25 August 2023', href: 'https://www.nrsc.gov.in/nrscnew/resources_atlas_landslide.php' },
  { name: 'Cotality · Property underwriting and human oversight · 3 June 2026', href: 'https://www.cotality.com/insights/articles/how-ai-in-insurance-underwriting-transforms-insurance-workflows' },
  { name: 'Google · Gemini API data-use terms · 28 April 2026', href: 'https://ai.google.dev/gemini-api/terms' },
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
