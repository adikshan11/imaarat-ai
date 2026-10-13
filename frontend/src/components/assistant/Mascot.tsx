export default function Mascot({ size = 56, talking = false }: { size?: number; talking?: boolean }) {
  return (
    <svg className={talking ? 'mascot mascot-talking' : 'mascot'} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M12 100c4-20 20-30 38-30s34 10 38 30z" fill="#0d4838" />
      <path d="M40 74l10 12 10-12" fill="none" stroke="#f2b632" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="44" y="64" width="12" height="12" rx="5" fill="#b87846" />
      <circle cx="26" cy="56" r="5" fill="#c98c5a" />
      <circle cx="74" cy="56" r="5" fill="#c98c5a" />
      <circle cx="24.5" cy="65" r="3" fill="#f2b632" />
      <circle cx="75.5" cy="65" r="3" fill="#f2b632" />
      <ellipse cx="50" cy="52" rx="24" ry="26" fill="#d59762" />
      <path d="M24 46c-1-20 11-32 26-32s27 12 26 32c-9-9-17-12-26-12s-17 3-26 12z" fill="#f08a24" />
      <path d="M29 38c12-9 30-9 42 0" fill="none" stroke="#fbc26a" strokeWidth="3" strokeLinecap="round" />
      <path d="M33 31c10-8 24-8 34 0" fill="none" stroke="#d96f12" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="26" r="4.5" fill="#f2b632" />
      <circle cx="50" cy="26" r="1.6" fill="#d1242a" />
      <circle cx="50" cy="42" r="2.2" fill="#d1242a" />
      <g className="mascot-eyes">
        <ellipse cx="40" cy="53" rx="3.4" ry="4.6" fill="#2a1a12" />
        <ellipse cx="60" cy="53" rx="3.4" ry="4.6" fill="#2a1a12" />
        <circle cx="41.2" cy="51.4" r="1.2" fill="#fff" />
        <circle cx="61.2" cy="51.4" r="1.2" fill="#fff" />
      </g>
      <circle cx="35" cy="62" r="4" fill="#e9736a" opacity="0.35" />
      <circle cx="65" cy="62" r="4" fill="#e9736a" opacity="0.35" />
      <path className="mascot-smile" d="M42 63c3 5 13 5 16 0" fill="none" stroke="#5a2a1c" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse className="mascot-mouth" cx="50" cy="65" rx="4.5" ry="3" fill="#5a2a1c" />
    </svg>
  )
}
