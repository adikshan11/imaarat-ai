import { LANGUAGES } from '../i18n/languages.ts'
import { GITHUB_PATH, GITHUB_PROFILE, INSTAGRAM_PATH, INSTAGRAM_PROFILE, X_PATH, X_PROFILE } from '../lib/social.ts'

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
      <nav aria-label="Main" className="shell flex h-20 items-center gap-3 sm:gap-8">
        <a href="/" className="header-brand flex items-center gap-3 font-semibold tracking-tight text-forest-900">
          <Mark className="mark-on-light size-10" />
          <Mark on="dark" className="mark-on-dark size-10" />
          <span translate="no" className="header-name text-lg sm:text-xl">imaarat<span className="header-accent text-forest-700">.ai</span></span>
        </a>
        <div className="header-links ml-auto hidden items-center gap-8 text-[15px] font-medium text-muted md:flex">
          <a href="/#steps" className="hover:text-forest-900">How it works</a>
          <a href="/#tour" className="hover:text-forest-900">Product</a>
          <a href="/#features" className="hover:text-forest-900">Features</a>
          <a href="/#faq" className="hover:text-forest-900">FAQ</a>
        </div>
        <div className="lang-pick ml-auto md:ml-0" data-lang-pick>
          <button type="button" id="landing-language" className="lang-button" aria-haspopup="listbox" aria-expanded="false" aria-controls="lang-list" aria-label="Language" title="Language">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
            <span className="lang-current" translate="no">English</span>
            <svg className="lang-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <ul id="lang-list" className="lang-list" role="listbox" tabIndex={-1} translate="no" aria-label="Language" hidden>
            {LANGUAGES.map(({ code, name, english, rtl }) => <li key={code} id={`lang-${code}`} role="option" data-code={code} lang={code} dir={rtl ? 'rtl' : undefined} title={english} aria-selected={code === 'en'}>{name}</li>)}
          </ul>
        </div>
        <a href={APP} className="header-cta inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-forest-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 sm:px-5">
          Open the app
        </a>
        <button type="button" id="nav-toggle" className="nav-toggle md:hidden" aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>
      <div id="mobile-menu" className="mobile-menu md:hidden" hidden>
        <div className="shell flex flex-col py-3">
          <a href="/#steps">How it works</a>
          <a href="/#tour">Product</a>
          <a href="/#features">Features</a>
          <a href="/#faq">FAQ</a>
          <a href={APP} className="mobile-menu-cta">Open the app</a>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  const columns: Array<[string, Array<[string, string]>]> = [
    ['Legal', [['Privacy Policy', '/privacy/'], ['Terms of Service', '/terms/']]],
    ['Product', [['Open the app', APP], ['How it works', `${DEMO}#how`], ['Status', `${DEMO}#status`], ['Changelog', '/changelog/'], ['FAQ', '/#faq']]],
    ['Connect', [['Email', 'mailto:adikshan11@gmail.com'], ['X', X_PROFILE], ['LinkedIn', 'https://www.linkedin.com/in/adithya-shankaran'], ['Source code', REPO], ['Report an issue', `${REPO}/issues/new`]]],
  ]
  return (
    <footer className="border-t border-forest-900/10 bg-white">
      <div className="shell grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div translate="no" className="flex items-center gap-2 text-lg font-semibold text-forest-900">
            <Mark className="size-7" /> imaarat.ai
          </div>
          <p className="mt-4 max-w-sm leading-relaxed text-muted">Verified property risk decisions for Indian insurers. Open source, built on India’s public hazard data.</p>
          <p translate="no" className="mt-5 flex items-center gap-4 text-forest-900">
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" aria-label="GitHub: adikshan11" className="hover:text-forest-700"><svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="currentColor" d={GITHUB_PATH} /></svg></a>
            <a href={X_PROFILE} target="_blank" rel="noreferrer" aria-label="X: @adithyashan11" className="hover:text-forest-700"><svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true"><path fill="currentColor" d={X_PATH} /></svg></a>
            <a href={INSTAGRAM_PROFILE} target="_blank" rel="noreferrer" aria-label="Instagram: @_adithya_shan" className="hover:text-forest-700"><svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true"><path fill="currentColor" d={INSTAGRAM_PATH} /></svg></a>
          </p>
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
        <p translate="no">Made with <span aria-label="love" className="text-red-600">♥</span> by <a href={PORTFOLIO} className="font-semibold text-forest-900 hover:underline">Adithya Shankaran</a></p>
      </div>
    </footer>
  )
}
