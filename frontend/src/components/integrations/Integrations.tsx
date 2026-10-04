import Card from '@/components/shared/Card'
import { apiBaseUrl } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'

const MCP_TOOLS = ['assess_property', 'lookup_hazard', 'search_guidelines', 'get_assessment', 'list_assessments']
const A2A_SKILLS = ['assess_property', 'underwriting_guidance']

export default function Integrations() {
  const { t } = usePreferences()
  const mcpUrl = `${apiBaseUrl}/mcp/`
  const cardUrl = `${apiBaseUrl}/.well-known/agent-card.json`
  return (
    <div>
      <div className="page-subtitle">{t('int.eyebrow')}</div>
      <h1 className="page-title">{t('int.title')}</h1>
      <p className="page-lead">{t('int.lead')}</p>

      <div className="dashboard-grid">
        <Card title={t('int.mcp_title')}>
          <p>{t('int.mcp_endpoint')} <code>{mcpUrl}</code></p>
          <div className="risk-stack form-gap">
            {MCP_TOOLS.map((name) => <div className="risk-line" key={name}><span><strong>{name}</strong>: {t(`int.tool.${name}`)}</span></div>)}
          </div>
          <p className="card-footnote">{t('int.mcp_note')}</p>
        </Card>
        <Card title={t('int.a2a_title')}>
          <p>{t('int.card')} <a href={cardUrl} target="_blank" rel="noreferrer"><code>{cardUrl}</code></a></p>
          <p className="form-gap">{t('int.rpc')} <code>{`${apiBaseUrl}/a2a`}</code></p>
          <div className="risk-stack form-gap">
            {A2A_SKILLS.map((name) => <div className="risk-line" key={name}><span><strong>{name}</strong>: {t(`int.skill.${name}`)}</span></div>)}
          </div>
        </Card>
      </div>

      <Card title={t('int.try')}>
        <pre className="code-block">{`curl -s ${apiBaseUrl}/a2a -H 'Content-Type: application/json' -H 'A2A-Version: 1.0' -d '{
  "jsonrpc": "2.0", "id": 1, "method": "SendMessage",
  "params": {"message": {"messageId": "m1", "role": "ROLE_USER",
    "parts": [{"data": {"construction_type": "Frame", "occupancy_type": "Warehouse",
      "cat_zone": "Flood", "roof_age_years": 32, "sprinkler_system": "N", "tiv": 30000000}}]}}
}'`}</pre>
      </Card>
    </div>
  )
}
