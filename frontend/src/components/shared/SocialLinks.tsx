import { GITHUB_PATH, GITHUB_PROFILE, X_PATH, X_PROFILE } from '@/lib/social'

export default function SocialLinks() {
  return (
    <span className="social-links" lang="en">
      <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" aria-label="GitHub: adikshan11" title="GitHub">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d={GITHUB_PATH} /></svg>
      </a>
      <a href={X_PROFILE} target="_blank" rel="noreferrer" aria-label="X: @adithyashan11" title="X">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d={X_PATH} /></svg>
      </a>
    </span>
  )
}
