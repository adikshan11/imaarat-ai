export const APP = '/app/#signin'
export const DEMO = '/app/?demo'
export const REPO = 'https://github.com/adikshan11/imaarat-ai'
export const PORTFOLIO = 'https://adithya-shankaran.vercel.app'

export function Mark({ className = '', on = 'light' }: { className?: string; on?: 'light' | 'dark' }) {
  return <img src={`/mark-${on}.svg`} alt="" width={32} height={32} className={className} />
}

export function SkipLink() {
  return <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
}

export function Header({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <header data-tone={tone} className="site-header sticky top-0 z-30">
      <nav aria-label="Main" className="shell flex h-20 items-center gap-8">
        <a href="/" className="header-brand flex items-center gap-3 font-semibold tracking-tight text-forest-900">
          <Mark className="mark-on-light size-10" />
          <Mark on="dark" className="mark-on-dark size-10" />
          <span className="text-xl">imaarat<span className="header-accent text-forest-700">.ai</span></span>
        </a>
        <div className="header-links ml-auto hidden items-center gap-8 text-[15px] font-medium text-muted md:flex">
          <a href="/#steps" className="hover:text-forest-900">How it works</a>
          <a href="/#tour" className="hover:text-forest-900">Product</a>
          <a href="/#features" className="hover:text-forest-900">Features</a>
          <a href="/#faq" className="hover:text-forest-900">FAQ</a>
        </div>
        <a href={APP} className="header-cta ml-auto inline-flex h-10 items-center rounded-full bg-forest-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 md:ml-0">
          Open the app
        </a>
      </nav>
    </header>
  )
}

export function Footer() {
  const columns: Array<[string, Array<[string, string]>]> = [
    ['Legal', [['Privacy Policy', '/privacy/'], ['Terms of Service', '/terms/']]],
    ['Product', [['Open the app', APP], ['How it works', `${DEMO}#how`], ['Status', `${DEMO}#status`], ['Changelog', '/changelog/'], ['FAQ', '/#faq']]],
    ['Connect', [['GitHub', REPO], ['LinkedIn', 'https://www.linkedin.com/in/adithya-shankaran'], ['Email', 'mailto:adikshan11@gmail.com'], ['Portfolio', PORTFOLIO], ['Report an issue', `${REPO}/issues/new`]]],
  ]
  return (
    <footer className="border-t border-forest-900/10 bg-white">
      <div className="shell grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-forest-900">
            <Mark className="size-7" /> imaarat.ai
          </div>
          <p className="mt-4 max-w-sm leading-relaxed text-muted">Verified property risk decisions for Indian insurers. Open source, built on India’s public hazard data.</p>
        </div>
        {columns.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="text-sm font-semibold text-forest-900">{title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {links.map(([label, href]) => <li key={label}><a href={href} className="hover:text-forest-900">{label}</a></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="shell flex flex-col gap-2 border-t border-forest-900/10 py-6 text-xs text-muted sm:px-6 md:flex-row md:justify-between">
        <p>© 2026 Adithya Shankaran · Illustrative photographs are generated with AI.</p>
        <p>Made with <span aria-label="love" className="text-red-600">♥</span> by <a href={PORTFOLIO} className="font-semibold text-forest-900 hover:underline">Adithya Shankaran</a></p>
      </div>
    </footer>
  )
}
