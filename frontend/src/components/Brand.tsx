export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 58" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="38" width="11" height="18" rx="2" fill="currentColor" />
      <rect x="24" y="28" width="11" height="28" rx="2" fill="currentColor" />
      <rect x="41" y="18" width="11" height="38" rx="2" fill="currentColor" />
      <path
        d="M5 30 23 17l11 5L57 3M46 3h11v11"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`brand ${className}`}>
      <BrandMark />
      <span>SUIVI</span>
    </span>
  );
}
export function TeamIllustration() {
  return (
    <svg className="team-illustration" viewBox="0 0 360 180" fill="none" aria-hidden="true">
      <ellipse cx="180" cy="165" rx="151" ry="12" fill="#dceaff" />
      {[
        { x: 58, y: 58, color: '#99bfe9' },
        { x: 111, y: 40, color: '#78a5dc' },
        { x: 248, y: 43, color: '#78a5dc' },
        { x: 299, y: 61, color: '#99bfe9' },
      ].map(({ x, y, color }) => (
        <g key={x}>
          <path d={`M${x - 25} ${y + 79}v-23q0-27 25-27t25 27v23`} fill={color} />
          <ellipse cx={x} cy={y + 8} rx="16" ry="20" fill="#c4dcf4" />
          <path d={`M${x - 16} ${y + 5}q-4-26 17-23 19 0 15 23l-6-13q-7 5-16 0Z`} fill={color} />
        </g>
      ))}
      <path d="M122 166v-29q0-43 58-43t58 43v29" fill="#1656a6" />
      <path d="m157 98 23 55 23-55-23 9Z" fill="#eff6ff" />
      <path d="m177 117-5 28 8 15 8-15-5-28 5-8h-16Z" fill="#062e69" />
      <ellipse cx="180" cy="65" rx="29" ry="36" fill="#88b9eb" />
      <path d="M151 65q-10-43 26-43 40-6 32 43l-9-23q-17 12-33 0Z" fill="#083c7d" />
    </svg>
  );
}
export function AuthWaves() {
  return (
    <svg
      className="auth-waves"
      viewBox="0 0 1200 110"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 12C230 30 390 130 680 82S1020 15 1200 45V110H0Z" fill="#c6defb" />
      <path d="M0 43C290 77 418 135 740 101S1010 52 1200 70V110H0Z" fill="#4892e6" />
      <path d="M0 66C270 80 383 130 710 108S1060 85 1200 95V110H0Z" fill="#0860c3" />
      <path d="M0 84C350 120 450 118 700 109H1200V110H0Z" fill="#05377b" />
    </svg>
  );
}
