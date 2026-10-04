import Card from '@/components/shared/Card'
import { apiBaseUrl } from '@/api/underwriting'

const MCP_TOOLS = [
  ['assess_property', 'Score a property with the deterministic engine; returns decision, flags and breakdown.'],
  ['search_guidelines', 'RAG search over the underwriting guidelines (Gemini embeddings in Qdrant).'],
  ['get_assessment', 'Fetch a stored assessment with its review status and AI rationale.'],
  ['list_assessments', 'List assessments, optionally filtered by decision.'],
]

export default function Integrations() {
  const mcpUrl = `${apiBaseUrl}/mcp/`
  const cardUrl = `${apiBaseUrl}/.well-known/agent-card.json`
  return (
    <div>
      <div className="page-subtitle">Interoperability</div>
      <h1 className="page-title">MCP server and A2A agent</h1>
      <p className="page-lead">The underwriting engine is usable by AI assistants (MCP) and by other agents (A2A), not just through this UI.</p>

      <div className="dashboard-grid">
        <Card title="MCP server (spec 2026-07-28, stateless)">
          <p>Streamable HTTP endpoint: <code>{mcpUrl}</code></p>
          <div className="risk-stack" style={{ marginTop: 12 }}>
            {MCP_TOOLS.map(([name, description]) => <div className="risk-line" key={name}><span><strong>{name}</strong>: {description}</span></div>)}
          </div>
          <p className="card-footnote">Resource <code>uw://guidelines</code> exposes the full guidelines. Add the URL as a remote MCP server in Claude, Copilot or any MCP client.</p>
        </Card>
        <Card title="A2A agent (protocol v1.0)">
          <p>Agent Card: <a href={cardUrl} target="_blank" rel="noreferrer"><code>{cardUrl}</code></a></p>
          <p style={{ marginTop: 8 }}>JSON-RPC endpoint: <code>{`${apiBaseUrl}/a2a`}</code></p>
          <div className="risk-stack" style={{ marginTop: 12 }}>
            <div className="risk-line"><span><strong>assess_property</strong>: send property facts as a data part; get score, decision, review status and cited rationale.</span></div>
            <div className="risk-line"><span><strong>underwriting_guidance</strong>: ask in text; get the most relevant guideline sections.</span></div>
          </div>
        </Card>
      </div>

      <Card title="Try A2A from a terminal">
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{`curl -s ${apiBaseUrl}/a2a -H 'Content-Type: application/json' -H 'A2A-Version: 1.0' -d '{
  "jsonrpc": "2.0", "id": 1, "method": "SendMessage",
  "params": {"message": {"messageId": "m1", "role": "ROLE_USER",
    "parts": [{"data": {"construction_type": "Frame", "occupancy_type": "Warehouse",
      "cat_zone": "Flood", "roof_age_years": 32, "sprinkler_system": "N", "tiv": 30000000}}]}}
}'`}</pre>
      </Card>
    </div>
  )
}
