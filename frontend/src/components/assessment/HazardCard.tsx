import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'
import type { OfficialHazard } from '@/types/backend'

const ZONES = ['II', 'III', 'IV', 'V']

export default function HazardCard({ hazard, declaredZone, pincode }: { hazard: OfficialHazard | null | undefined; declaredZone?: string | null; pincode?: string }) {
  const { t, label } = usePreferences()
  if (!hazard) {
    return pincode && pincode.replace(/\D/g, '').length === 6 ? <Card title={t('hz.title')}><p>{t('hz.none')}</p></Card> : null
  }
  const understated = hazard.seismic_zone && declaredZone && ZONES.indexOf(hazard.seismic_zone) > ZONES.indexOf(declaredZone)

  return (
    <Card title={t('hz.title')} className={understated ? 'card-attention' : undefined}>
      <p>{t('hz.lead', { pincode: hazard.pincode, district: hazard.district ?? '—', state: hazard.state ?? '—' })}</p>
      <div className="risk-stack form-gap">
        <div className="risk-line"><span>{t('hz.seismic')}</span><strong>{hazard.seismic_zone ? t('hz.zone', { zone: hazard.seismic_zone }) : '—'}</strong></div>
        <div className="risk-line"><span>{t('hz.flood')}</span><strong><bdi dir="ltr">{hazard.flood_area_pct}%</bdi></strong></div>
        {hazard.urban_flood_points !== null && hazard.urban_flood_points !== undefined && <div className="risk-line"><span>{t('hz.urban', { source: hazard.urban_flood_source ?? '' })}</span><strong>{hazard.urban_flood_points}</strong></div>}
        <div className="risk-line"><span>{t('hz.cyclone')}</span><strong>{hazard.cyclone_grade ? label('grade', hazard.cyclone_grade) : t('hz.cyclone_none')}</strong></div>
      </div>
      <p className="card-footnote">{hazard.seismic_source?.startsWith('IS 1893 town list: ') ? t('hz.source_town', { town: hazard.seismic_source.slice(19) }) : t('hz.source_map')}</p>
      {understated && <div className="notice">{t('hz.understated', { declared: declaredZone ?? '', official: hazard.seismic_zone ?? '' })}</div>}
      <p className="card-footnote">{t('hz.note')}</p>
    </Card>
  )
}
