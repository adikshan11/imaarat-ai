import type { ReactNode } from 'react'
import { APP, Footer, Header, REPO, SkipLink } from './site.tsx'


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
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint-300">Commercial property insurance · India</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          From a hand-filled proposal to a clear, cited risk decision.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
          imaarat.ai checks the property’s PIN code against government hazard data, applies written underwriting rules and explains the result in plain words. You stay in charge of every decision.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`${APP}#new`} className="inline-flex h-12 items-center rounded-full bg-mint-300 px-6 font-semibold text-forest-950 shadow-lg shadow-black/20 transition hover:bg-white">Try the free demo</a>
          <a href={`${APP}#paper`} className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 font-semibold text-white transition hover:bg-white/10">See the paper form</a>
        </div>
        <dl className="mt-14 grid max-w-2xl grid-cols-1 gap-6 border-t border-white/15 pt-8 sm:grid-cols-3">
          {[['19,312', 'PIN codes with hazard data'], ['26', 'Indian languages'], ['1 page', 'paper proposal, read by AI']].map(([value, label]) => (
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

function Steps() {
  const steps = [
    ['Enter or photograph the proposal', 'Type the details, or print the one-page form, let the business owner fill it by hand and take a photo. AI reads it and a person confirms every value.'],
    ['Check hazards and apply the rules', 'The PIN code brings in earthquake zone, flood history and cyclone exposure. Written rules score the risk and show the points behind the decision.'],
    ['Read the summary and approve', 'An AI risk summary explains the decision and cites the guideline used. Referrals wait for an underwriter, and every override is noted.'],
  ]
  return (
    <section id="steps" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">Rules decide. AI explains. You approve.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">Three steps from proposal to decision, each one visible and checkable.</p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-3xl border border-forest-900/10 bg-white p-7 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-mint-100 font-bold text-forest-900">{index + 1}</span>
              <h3 className="mt-5 text-xl font-semibold text-forest-900">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
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
        <div role="tablist" aria-label="Product screens" data-tabs className="mt-10 flex gap-2 overflow-x-auto pb-1">
          {tour.map((item, index) => (
            <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-selected={index === 0} aria-controls={`panel-${item.id}`} tabIndex={index === 0 ? 0 : -1}
              className="h-11 shrink-0 rounded-full bg-white px-5 text-sm font-semibold text-forest-900 ring-1 ring-forest-900/15 transition hover:bg-mint-50 aria-selected:bg-forest-900 aria-selected:text-white aria-selected:ring-0">
              {item.label}
            </button>
          ))}
        </div>
        {tour.map((item, index) => (
          <div key={item.id} role="tabpanel" id={`panel-${item.id}`} aria-labelledby={`tab-${item.id}`} hidden={index !== 0} className="mt-6">
            <img src={`/landing/shot-${item.image}-1440.webp`} srcSet={`/landing/shot-${item.image}-720.webp 720w, /landing/shot-${item.image}-1440.webp 1440w`} sizes="(min-width: 1152px) 1104px, 100vw"
              alt={item.alt} width={1440} height={900} loading="lazy" decoding="async" className="w-full rounded-2xl border border-forest-900/10 bg-white shadow-2xl shadow-forest-950/15" />
          </div>
        ))}
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
        <Steps />
        <Features />
        <Tour />
        <Checked />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
