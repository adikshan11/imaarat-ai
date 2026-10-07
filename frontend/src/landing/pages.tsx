import type { ReactNode } from 'react'
import changelog from '../../../CHANGELOG.md?raw'
import { APP, Footer, Header, REPO, SkipLink } from './site.tsx'

const UPDATED = '7 October 2026'

function Document({ title, lead, children }: { title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight text-forest-900 sm:text-5xl">{title}</h1>
        <p className="mt-4 text-lg text-muted">{lead}</p>
        <div className="mt-12 space-y-10 leading-relaxed text-ink [&_a]:font-medium [&_a]:text-forest-700 [&_a]:underline [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-forest-900 [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}

export function Privacy() {
  return (
    <Document title="Privacy policy" lead={`What imaarat.ai collects, why, who handles it and how long it is kept. Last updated ${UPDATED}.`}>
      <section>
        <h2>Who runs this</h2>
        <p>imaarat.ai is an independent prototype built and run by Adithya Shankaran. It is not an insurer, a broker or an insurance intermediary.</p>
      </section>
      <section>
        <h2>Please use sample data</h2>
        <p>This is a public demo. Do not enter personal information, such as the names, phone numbers or home addresses of real people, or confidential business information.</p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Assessment details</strong> you type or upload: the property, its sums insured, protections and claims history. They are stored in our database so the assessment appears in the portfolio.</li>
          <li><strong>Photos.</strong> A property photo is kept in temporary server storage while the assessment runs and disappears when the server restarts. A photo of the paper form is read and not stored.</li>
          <li><strong>Request records:</strong> for each request, the page or API route, the result code and how long it took. Not what you typed. Kept for 14 days.</li>
          <li><strong>A daily visitor count.</strong> To share the daily AI allowance fairly, requests are counted per visitor using a one-way code made from the IP address that changes every day. The address itself is not stored.</li>
          <li><strong>Signing in</strong> is optional and only needed to review referrals. If you sign in with GitHub, we store your GitHub account’s numeric ID, your role and a hashed copy of your session. We do not receive your name, email address or repositories.</li>
          <li><strong>Your browser</strong> keeps your language and light or dark choice in local storage. If you sign in, one cookie keeps you signed in; it is removed when you sign out. There are no analytics or advertising trackers.</li>
        </ul>
      </section>
      <section>
        <h2>Who handles it</h2>
        <ul>
          <li><strong>Vercel</strong> hosts the site and API in Singapore and keeps standard request logs.</li>
          <li><strong>Neon</strong> hosts the database in Singapore.</li>
          <li><strong>GitHub</strong> confirms your identity when you choose to sign in.</li>
          <li><strong>Google (Gemini API)</strong> receives assessment details and photos to read paper forms, review photos and write the AI risk summary. The demo uses Google’s free tier, under which Google may use what is sent to improve its products.</li>
          <li><strong>Langfuse</strong> (in the EU) records the text of AI requests and responses, not photos, so their quality can be checked. On its free plan they are available for 30 days.</li>
        </ul>
      </section>
      <section>
        <h2>How long it is kept</h2>
        <p>Assessments stay until they are removed. Request records are deleted after 14 days. AI quality records are available for 30 days. A sign-in session ends after 30 minutes without activity or 12 hours at most; your account record stays until you ask for it to be removed.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>To have an assessment removed or to ask a question, open an issue on <a href={`${REPO}/issues`}>GitHub</a>. We aim to follow India’s Digital Personal Data Protection Act, 2023.</p>
      </section>
      <section>
        <h2>Children</h2>
        <p>imaarat.ai is meant for people working in insurance and is not intended for anyone under 18.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>Changes to this policy are published on this page with a new date, and listed in the <a href="/changelog/">changelog</a>.</p>
      </section>
    </Document>
  )
}

export function Terms() {
  return (
    <Document title="Terms of use" lead={`The rules for using imaarat.ai. Last updated ${UPDATED}.`}>
      <section>
        <h2>What imaarat.ai is</h2>
        <p>An independent prototype that shows how property proposals can be assessed with public hazard data, written rules and AI. It is not insurance advice. Its decisions, scores and product segments are indicative and are not an insurer’s offer, quote, rate or tariff. Underwriting decisions stay with a qualified person.</p>
      </section>
      <section>
        <h2>Using it</h2>
        <ul>
          <li>Use sample data only; do not enter personal or confidential information.</li>
          <li>Do not try to overload the service, get around its limits or attack it. The public APIs (GraphQL, MCP and A2A) follow the same limits as the app.</li>
          <li>The demo has a small daily AI allowance shared by everyone. When it runs out, the rules still decide and the page says so.</li>
          <li>Signing in with GitHub is optional. Approving or overriding a referral needs a reviewer account, and you are responsible for what is done with yours.</li>
        </ul>
      </section>
      <section>
        <h2>AI output</h2>
        <p>Text written by AI can be wrong or incomplete. Check it before relying on it.</p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>The demo is free, may be unavailable at times, and sample data may be reset.</p>
      </section>
      <section>
        <h2>Data and credits</h2>
        <p>Hazard data comes from public sources under their own licences, listed in the app’s <a href={`${APP}#how`}>How it works</a> page. The photographs on the website are generated with AI.</p>
      </section>
      <section>
        <h2>Open source</h2>
        <p>The source code is published under the <a href={`${REPO}/blob/main/LICENSE`}>MIT licence</a>.</p>
      </section>
      <section>
        <h2>No warranty</h2>
        <p>imaarat.ai is provided as is, without warranty of any kind. To the extent the law allows, its author is not liable for any loss arising from its use.</p>
      </section>
      <section>
        <h2>Changes and law</h2>
        <p>These terms may change; the date above shows the latest version. They are governed by the laws of India.</p>
      </section>
    </Document>
  )
}

type Release = { version: string; date: string; groups: Array<{ name: string; items: string[] }> }

function releases(text: string): Release[] {
  const result: Release[] = []
  for (const line of text.split('\n')) {
    const release = line.match(/^## \[(.+?)\] - (\S+)/)
    if (release) result.push({ version: release[1], date: release[2], groups: [] })
    else if (line.startsWith('### ') && result.length) result.at(-1)!.groups.push({ name: line.slice(4).trim(), items: [] })
    else if (line.startsWith('- ') && result.at(-1)?.groups.length) result.at(-1)!.groups.at(-1)!.items.push(line.slice(2).trim())
  }
  return result
}

export function Changelog() {
  return (
    <Document title="Changelog" lead="Every release of imaarat.ai, newest first. Each one passed the automated tests before it went live.">
      {releases(changelog).map((release) => (
        <section key={release.version} id={`v${release.version}`}>
          <h2>{release.version} <span className="text-base font-medium text-muted">· {release.date}</span></h2>
          {release.groups.map((group) => (
            <div key={group.name}>
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-forest-700">{group.name}</h3>
              <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </section>
      ))}
    </Document>
  )
}
