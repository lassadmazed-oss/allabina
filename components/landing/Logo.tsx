/**
 * شعار اللبنة: المصباح والمباني الذهبية والموجة، مع الاسم.
 * إن وُجد ملفّ شعار (PNG/SVG) يُمرَّر في src وإلّا يُرسم المعلَم بالـSVG.
 */
export default function Logo({
  light = false,
  id = 'lp-logo',
  mark = 46,
  src,
}: {
  light?: boolean
  id?: string
  mark?: number
  src?: string
}) {
  const navy = light ? '#FFFFFF' : '#0E3A5B'
  const g = `url(#${id})`
  return (
    <span className={`logo${light ? ' logo--light' : ''}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" height={mark} style={{ height: mark, width: 'auto' }} />
      ) : (
        <svg width={Math.round(mark * 1.45)} height={mark} viewBox="0 0 100 70" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#EBCB86" />
              <stop offset="0.55" stopColor="#D4A15E" />
              <stop offset="1" stopColor="#A9762A" />
            </linearGradient>
          </defs>
          <rect x="56" y="10" width="10" height="28" rx="1" fill={g} />
          <rect x="69" y="2" width="12" height="36" rx="1" fill={g} />
          <rect x="84" y="16" width="9" height="22" rx="1" fill={g} />
          <path d="M46 22 L54 17 V38 H46 Z" fill={navy} />
          <path d="M10 44 C 34 28, 60 50, 98 32" fill="none" stroke={g} strokeWidth="5" strokeLinecap="round" />
          <path
            d="M16 55 C 16 48 24 45 34 45 H 50 C 56 45 60 47 62 50 L 78 42 L 66 56 C 63 62 56 66 46 66 H 30 C 20 66 16 61 16 55 Z"
            fill={g}
          />
          <path d="M16 53 C 5 53 5 65 16 64" fill="none" stroke={g} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="42" cy="45" rx="9" ry="2.6" fill="#A9762A" />
          <circle cx="42" cy="41" r="3" fill={g} />
          <rect x="30" y="66" width="24" height="3.5" rx="1.75" fill="#A9762A" />
        </svg>
      )}
      <span className="logo__t">
        <b>اللبنة</b>
        <small>للبناء والإعمار</small>
        <em>LABNA</em>
      </span>
    </span>
  )
}
