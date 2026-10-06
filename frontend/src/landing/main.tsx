import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './landing.css'
import Landing from './Landing.tsx'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <Landing />
  </StrictMode>,
)
