import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import Landing from './Landing.tsx'

export function render() {
  return renderToString(
    <StrictMode>
      <Landing />
    </StrictMode>,
  )
}
