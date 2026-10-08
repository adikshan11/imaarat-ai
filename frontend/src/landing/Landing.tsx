import type { ReactNode } from 'react'
import { version } from '../../package.json'
import { APP, Footer, Header, REPO, SkipLink } from './site.tsx'
import { stack as tools, type Tool } from './stack.ts'


const photo = (name: string, widths: number[]) => ({
  src: `/landing/${name}-${widths[1] ?? widths[0]}.webp`,
  srcSet: widths.map((width) => `/landing/${name}-${width}.webp ${width}w`).join(', '),
})

const tour = [
  { id: 'portfolio', label: 'Portfolio', image: 'dashboard', alt: 'Portfolio dashboard with assessments, average risk score, protection in place and top risk drivers' },
  { id: 'result', label: 'Assessment result', image: 'result', alt: 'Assessment result with risk score, decision, reasons and score breakdown' },
  { id: 'paper', label: 'Paper form', image: 'paper', alt: 'Paper form page with a printable one-page proposal and photo upload' },
  { id: 'status', label: 'Live status', image: 'status', alt: 'Status page with request traffic, AI calls, assessment timing and CI test results' },
]

const faqs: Array<[string, ReactNode]> = [
  ['Does the AI decide whether a property is accepted?', 'No. Written rules make every decision and show the points behind it. The AI risk summary explains that decision in plain words and cites the guideline it used. Referrals wait for a person to approve them, and an override needs a note.'],
  ['Where does the hazard data come from?', 'Public data: India Post PIN-code boundaries and earthquake zones from IS 1893 on data.gov.in, satellite-observed flood inundation from NRSC and NDEM for 1998 to 2022, IMD’s cyclone-prone districts, and flooding spots published by the Chennai and Bengaluru city corporations. Each result names its source.'],
  ['What happens to the details I enter?', 'The paper form asks only about the property and its risks, not about people. This free demo uses a free AI service, so please do not enter personal or confidential information.'],
  ['Is this an insurer’s price or quote?', 'No. imaarat.ai is an independent prototype. Its decisions and product segments are indicative and are not an insurer’s rate, tariff or offer.'],
  ['Which languages does it support?', 'The app is available in 26 Indian languages. Reading paper forms has been tested with handwriting-style fonts in English, Hindi, Tamil, Bengali, Telugu, Malayalam and Gujarati; tests with real handwriting are next.'],
  ['Why is the AI summary sometimes unavailable?', 'The demo shares a small free daily AI allowance across all visitors. When it runs out, or Google’s model is busy, the rules still decide and the page says so.'],
]

function Hero() {
  const hero = photo('hero', [640, 1280, 1920, 2560])
  return (
    <section className="relative isolate overflow-hidden bg-forest-950 text-white">
      <img {...hero} sizes="100vw" alt="" width={2560} height={1440} fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 size-full object-cover object-[70%_center]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/85 to-forest-950/10" />
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:pt-32">
        <a href="/changelog/" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 transition hover:bg-white/20">
          <span className="rounded-full bg-mint-300 px-2 py-0.5 font-semibold text-forest-950">v{version.split('.').slice(0, 2).join('.')}</span> See what’s new →
        </a>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-mint-300">Property risk underwriting · India</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Verified property risk decisions for Indian insurers.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
          imaarat.ai reads hand-filled proposals in Indian languages, checks what each one declares against official hazard data for its PIN code, and gives your underwriter a scored, explained decision to sign off.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`${APP}#new`} className="inline-flex h-12 items-center rounded-full bg-mint-300 px-6 font-semibold text-forest-950 shadow-lg shadow-black/20 transition hover:bg-white">Try the live demo</a>
          <a href={`${APP}#paper`} className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 font-semibold text-white transition hover:bg-white/10">See a paper proposal</a>
        </div>
        <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-6 border-t border-white/15 pt-8 sm:grid-cols-4">
          {[['19,312', 'PIN codes covered, metro to rural'], ['11', 'official and public data sources'], ['26', 'Indian languages'], ['< 1 min', 'from proposal to decision']].map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-3xl font-bold tracking-tight">{value}</dd>
              <dd className="mt-1 text-sm text-white/70">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

const checks = [
  ['Earthquake zone', 'If a proposal states a lower zone than the IS 1893 map gives for its PIN code, the official zone is scored and the case is flagged.'],
  ['Flood history', 'Satellite-observed flooding from 1998 to 2022, and flooding spots published by city corporations, are added even when the proposal is silent.'],
  ['Cyclone exposure', 'Properties in districts that the India Meteorological Department lists as cyclone-prone are flagged automatically.'],
]

function Logo({ tool }: { tool: Tool }) {
  if (tool.src) return <img src={tool.src} alt="" width={tool.wide ? 64 : 32} height="32" loading="lazy" className={`h-8 ${tool.wide ? 'w-16' : 'w-8'} object-contain`} />
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8" fill={tool.color}><path d={tool.path} /></svg>
}

function WorksWith() {
  return (
    <section aria-label="Built with" className="border-b border-forest-900/10 bg-white py-8">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 sm:px-6">
        <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-forest-700">Built with</span>
        <div className="marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} className="marquee-group" aria-hidden={copy === 1 ? 'true' : undefined}>
              {tools.map((tool) => (
                <li key={tool.name} className="shrink-0">
                  <a href={tool.href} target="_blank" rel="noopener noreferrer" tabIndex={copy === 1 ? -1 : undefined} className="flex items-center gap-3 rounded-lg px-2 py-1 text-base font-semibold text-ink opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0">
                    <Logo tool={tool} />
                    {tool.name}
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}

function Verified() {
  return (
    <section id="verify" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">Declared is not the same as verified.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">Proposals are filled in by the people asking for cover. imaarat.ai checks what they declare against sources they do not control.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {checks.map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-forest-900/10 bg-white p-7 shadow-sm">
              <h3 className="text-xl font-semibold text-forest-900">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">The live portfolio shows how many proposals understate their hazards.</p>
      </div>
    </section>
  )
}

const stages = [
  ['intake', 'Intake', 'Type the proposal, or photograph the one-page paper form. AI reads the fields in the proposer’s language, and a person confirms each value before it is used.'],
  ['hazard', 'Verification', 'The PIN code brings in the official earthquake zone, flood history, cyclone exposure and known city flooding spots, each with its source.'],
  ['rules', 'Scoring', 'Written underwriting rules score the risk and show every point: which hazards added risk and which protections took it away.'],
  ['summary', 'Explanation', 'An AI risk summary explains the decision in plain words and cites the guideline it relied on. If the AI is unavailable, the rules still decide and the page says so.'],
  ['review', 'Sign-off', 'Referrals wait for a signed-in reviewer. An override needs a written reason, and every decision can be downloaded as a PDF report.'],
  ['portfolio', 'Portfolio', 'See exposure across every assessment, live: decisions, risk bands, the most common risk drivers and how many proposals understate their hazards.'],
]

function Journey() {
  return (
    <section id="steps" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">From paper proposal to signed-off decision.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">Six steps. Each one is recorded and can be inspected later.</p>
        <div role="tablist" aria-label="Underwriting steps" data-tabs className="mt-10 flex gap-2 overflow-x-auto pb-1">
          {stages.map(([id, label], index) => (
            <button key={id} type="button" role="tab" id={`stage-tab-${id}`} aria-selected={index === 0} aria-controls={`stage-${id}`} tabIndex={index === 0 ? 0 : -1}
              className="group h-11 shrink-0 rounded-full bg-sand-50 px-5 text-sm font-semibold text-forest-900 ring-1 ring-forest-900/15 transition hover:bg-mint-50 aria-selected:bg-forest-900 aria-selected:text-white aria-selected:ring-0">
              <span className="mr-2 text-forest-700 group-aria-selected:text-mint-300">{index + 1}</span>{label}
            </button>
          ))}
        </div>
        {stages.map(([id, label, body], index) => (
          <div key={id} role="tabpanel" id={`stage-${id}`} aria-labelledby={`stage-tab-${id}`} hidden={index !== 0} className="mt-6 rounded-3xl border border-forest-900/10 bg-sand-50 p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-forest-700">Step {index + 1} of {stages.length}</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-forest-900">{label}</h3>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Row({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-1.5 last:border-0">
      <span className="text-white/60">{label}</span>
      <span className={`text-right font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="mt-5 rounded-2xl bg-forest-950/60 p-4 text-sm ring-1 ring-white/10">{children}</div>
}

const scoreParts: Array<[string, number]> = [['Natural catastrophe', 20], ['Sum insured at one location', 5], ['Construction', 0], ['Claims history', 0]]

const modules: Array<[string, string, ReactNode]> = [
  ['Paper reader', 'Reads a photographed proposal into fields that a person confirms.', (
    <Panel key="paper">
      <Row label="Construction" value="Non-combustible ✓" />
      <Row label="Occupancy" value="Office ✓" />
      <Row label="Sprinklers" value="Yes ✓" />
      <Row label="PIN code" value="600113 ✓" />
    </Panel>
  )],
  ['Hazard verification', 'Looks up official hazard data for the PIN code, with the source of each fact.', (
    <Panel key="hazard">
      <Row label="Earthquake zone (IS 1893)" value="III" />
      <Row label="Area flooded, 1998–2022" value="7.2%" tone="text-amber-300" />
      <Row label="City flooding spots" value="16" tone="text-amber-300" />
      <Row label="IMD cyclone grade" value="P2" tone="text-amber-300" />
    </Panel>
  )],
  ['Rule engine', 'Scores the risk with written rules and shows every point.', (
    <Panel key="rules">
      {scoreParts.map(([label, points]) => (
        <div key={label} className="py-1">
          <div className="flex justify-between text-white/60"><span>{label}</span><span className="font-semibold text-white">+{points}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-mint-300" style={{ width: `${points * 4}%` }} /></div>
        </div>
      ))}
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="font-semibold">25 / 100</span>
        <span className="rounded-full bg-mint-300 px-3 py-0.5 text-xs font-bold text-forest-950">Accept</span>
      </div>
    </Panel>
  )],
  ['AI risk summary', 'Explains the decision in plain words, using only the facts above.', (
    <Panel key="summary">
      <p className="leading-relaxed text-white/85">“The property is approved with a risk score of 25, which falls within the standard acceptance range of 0–30 … mitigated by its non-combustible construction, office occupancy, and the presence of an active sprinkler system.”</p>
    </Panel>
  )],
  ['Sign-off and reports', 'Referrals wait for a signed-in reviewer; every decision exports as a PDF.', (
    <Panel key="signoff">
      <Row label="Rule decision" value="Accept" />
      <Row label="Reviewer" value="Needed for referrals" />
      <Row label="Override" value="Needs a written reason" />
      <Row label="Report" value="PDF, ready to share" />
    </Panel>
  )],
  ['Open APIs', 'Lets other systems and AI agents run the same assessment.', (
    <Panel key="apis">
      <Row label="AI assistants" value="MCP" />
      <Row label="Other AI agents" value="A2A" />
      <Row label="Your own systems" value="GraphQL and REST" />
      <Row label="Same rules and limits" value="Yes" />
    </Panel>
  )],
]

function Modules() {
  return (
    <section className="bg-forest-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Modular by design.</h2>
        <p className="mt-4 max-w-2xl text-lg text-white/75">Six modules, each usable on its own. Shown here on one real assessment from the demo: an office at TIDEL Park, Chennai, PIN code 600113.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([name, body, example]) => (
            <div key={name} className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <h3 className="text-xl font-semibold">{name}</h3>
              <p className="mt-2 leading-relaxed text-white/75">{body}</p>
              {example}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const audiences = [
  ['Underwriters at insurers', 'Spend time on judgement, not data entry. The hazard facts, the score breakdown and a draft explanation are ready before you start.'],
  ['Brokers and agents', 'Collect a proposal on paper at the shop counter, photograph it, and see an indicative decision in under a minute, in the client’s language.'],
  ['Business owners', 'See why a property is rated the way it is, and how protections such as sprinklers, fire alarms or flood barriers change the picture.'],
]

const reasons = [
  ['Every PIN code, not only metros', 'The same checks run for a taluka town as for Mumbai, because they come from national public datasets.'],
  ['Starts where Indian business starts', 'Proposals filled in by hand, in the proposer’s language, are read by AI and confirmed by a person, so nothing has to be retyped.'],
  ['Decisions you can defend', 'Written rules decide, the AI explains with citations, and a person signs off. Every step is recorded.'],
  ['Open and inspectable', 'Open-source code, public test runs and a live status page. Run it yourself with one command, or use the hosted demo.'],
]

function Audiences() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">Who it is for.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {audiences.map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-forest-900/10 bg-white p-7 shadow-sm">
              <h3 className="text-xl font-semibold text-forest-900">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-24 max-w-2xl text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">Why imaarat.ai.</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {reasons.map(([title, body]) => (
            <div key={title} className="border-l-4 border-mint-300 pl-5">
              <dt className="text-lg font-semibold text-forest-900">{title}</dt>
              <dd className="mt-2 leading-relaxed text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Feature({ image, widths, title, eyebrow, children, flip }: { image: string; widths: number[]; title: string; eyebrow: string; children: ReactNode; flip?: boolean }) {
  const picture = photo(image, widths)
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : ''}>
        <img {...picture} sizes="(min-width: 1024px) 560px, 100vw" alt="" width={1536} height={1024} loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-3xl object-cover shadow-xl shadow-forest-950/10" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-forest-700">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-forest-900 sm:text-3xl">{title}</h3>
        <div className="mt-4 space-y-4 text-lg leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:space-y-28 sm:px-6">
        <Feature image="paper-form" widths={[640, 1024, 1536]} eyebrow="Paper forms" title="Handwritten proposals, read in the proposer’s language">
          <p>Many small businesses still fill proposals on paper. Print the one-page form, let the owner write in their own language, and photograph it.</p>
          <p>AI reads each field into the assessment. Nothing is used until a person has checked it.</p>
        </Feature>
        <Feature image="flood-risk" widths={[640, 1280, 1920]} eyebrow="Hazard check" title="Earthquake, flood and cyclone exposure from the PIN code" flip>
          <p>The earthquake zone comes from IS 1893, flood history from satellite-observed inundation between 1998 and 2022, cyclone exposure from IMD’s list of cyclone-prone districts, and known flooding spots from the Chennai and Bengaluru city corporations.</p>
          <p>Every lookup names its source, so an underwriter can check it.</p>
        </Feature>
        <Feature image="underwriter" widths={[640, 1024, 1536]} eyebrow="Explain and approve" title="A decision you can defend, in plain words">
          <p>The score breakdown shows exactly which risks added points and which protections took them away. The AI risk summary turns that into a short explanation with the guideline it relied on.</p>
          <p>Cases that need judgement are referred to an underwriter, and a report can be downloaded as a PDF.</p>
        </Feature>
      </div>
    </section>
  )
}

function Tour() {
  return (
    <section id="tour" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">See the product</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">Screenshots from the live demo, which uses sample properties only.</p>
        <div data-tabs-region>
          <div className="mt-10 flex items-center gap-2">
            <div role="tablist" aria-label="Product screens" id="tour-tabs" data-tabs data-tabs-auto="6000" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {tour.map((item, index) => (
                <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-selected={index === 0} aria-controls={`panel-${item.id}`} tabIndex={index === 0 ? 0 : -1}
                  className="h-11 shrink-0 rounded-full bg-white px-5 text-sm font-semibold text-forest-900 ring-1 ring-forest-900/15 transition hover:bg-mint-50 aria-selected:bg-forest-900 aria-selected:text-white aria-selected:ring-0">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="tour-stage mt-6">
            {tour.map((item, index) => (
              <div key={item.id} role="tabpanel" id={`panel-${item.id}`} aria-labelledby={`tab-${item.id}`} data-inactive={index !== 0 ? '' : undefined} inert={index !== 0}>
                <img src={`/landing/shot-${item.image}-1440.webp`} srcSet={`/landing/shot-${item.image}-720.webp 720w, /landing/shot-${item.image}-1440.webp 1440w`} sizes="(min-width: 1152px) 1104px, 100vw"
                  alt={item.alt} width={1440} height={900} loading="lazy" decoding="async" className="w-full rounded-2xl border border-forest-900/10 bg-white shadow-2xl shadow-forest-950/15" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Checked() {
  const items = [
    ['Live status page', 'Requests, errors, AI calls and the time each step of an assessment takes, updated as people use it.', `${APP}#status`],
    ['Tested on every change', 'Unit tests, browser tests in several languages, load tests with up to 200 simulated users, Lighthouse audits and AI evaluations run in GitHub Actions.', `${REPO}/actions`],
    ['Open source', 'The code, the hazard data pipeline and every test run are public on GitHub.', REPO],
  ]
  return (
    <section className="bg-forest-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Built to be checked</h2>
        <p className="mt-4 max-w-2xl text-lg text-white/75">Nothing here asks for blind trust. Each claim on this page links to something you can open.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map(([title, body, href]) => (
            <a key={title} href={href} className="group rounded-3xl border border-white/10 bg-white/5 p-7 transition hover:border-mint-300/50 hover:bg-white/10">
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-relaxed text-white/75">{body}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-mint-300 group-hover:underline">Open →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">Questions</h2>
        <div className="mt-10 divide-y divide-forest-900/10 border-y border-forest-900/10">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold text-forest-900 [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden="true" className="text-2xl leading-none text-forest-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-16 rounded-3xl bg-mint-100 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-forest-900 sm:text-3xl">Try it with a sample property</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">No sign-up. Enter a PIN code and a few details, and see the decision, the reasons and the risk summary.</p>
          <a href={`${APP}#new`} className="mt-7 inline-flex h-12 items-center rounded-full bg-forest-900 px-7 font-semibold text-white transition hover:bg-forest-800">Start an assessment</a>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <Hero />
        <WorksWith />
        <Verified />
        <Journey />
        <Modules />
        <Features />
        <Audiences />
        <Tour />
        <Checked />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
