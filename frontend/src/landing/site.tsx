export const APP = '/app/'
export const REPO = 'https://github.com/adikshan11/uw-risk-assessment'

export function Mark({ className = '' }: { className?: string }) {
  return <img src="/favicon.svg?v=imaarat-2" alt="" width={32} height={32} className={className} />
}

export function SkipLink() {
  return <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-forest-900/10 bg-sand-50/85 backdrop-blur supports-[backdrop-filter]:bg-sand-50/70">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-forest-900">
          <Mark className="size-8" />
          <span className="text-lg">imaarat<span className="text-forest-700">.ai</span></span>
        </a>
        <div className="ml-auto hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          <a href="/#steps" className="hover:text-forest-900">How it works</a>
          <a href="/#features" className="hover:text-forest-900">Features</a>
          <a href="/#tour" className="hover:text-forest-900">Product</a>
          <a href="/#faq" className="hover:text-forest-900">FAQ</a>
        </div>
        <a href={APP} className="ml-auto inline-flex h-10 items-center rounded-full bg-forest-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 md:ml-0">
          Open the app
        </a>
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-forest-900/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-semibold text-forest-900">
          <Mark className="size-6" /> imaarat.ai
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href={APP} className="hover:text-forest-900">Open the app</a>
          <a href={`${APP}#how`} className="hover:text-forest-900">How it works</a>
          <a href={`${APP}#status`} className="hover:text-forest-900">Status</a>
          <a href="/changelog/" className="hover:text-forest-900">Changelog</a>
          <a href="/privacy/" className="hover:text-forest-900">Privacy</a>
          <a href="/terms/" className="hover:text-forest-900">Terms</a>
          <a href={`${REPO}/blob/main/LICENSE`} className="hover:text-forest-900">MIT licence</a>
          <a href={REPO} className="hover:text-forest-900">GitHub</a>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl space-y-1 px-4 pb-10 text-xs text-muted sm:px-6">
        <p>Made with <span aria-label="love" className="text-red-600">♥</span> by Adithya Shankaran · © 2026 imaarat.ai</p>
        <p>Illustrative photographs are generated with AI. Product screenshots are from the live demo with sample data.</p>
      </div>
    </footer>
  )
}
