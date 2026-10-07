import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import Landing from './Landing.tsx'
import { Changelog, Privacy, Terms } from './pages.tsx'

const PAGES = { landing: Landing, privacy: Privacy, terms: Terms, changelog: Changelog }

export function render(page: keyof typeof PAGES) {
  const Page = PAGES[page]
  return renderToString(
    <StrictMode>
      <Page />
    </StrictMode>,
  )
}
