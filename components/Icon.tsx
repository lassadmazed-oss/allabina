/**
 * إيكونات اللوحة — خطّية، بلا مكتبة.
 *
 * الماكيتة تضع إيكونة على كلّ سطر تنقّل وكلّ بطاقة رقم. ومكتبة إيكونات
 * كاملة لعشرين رمزاً تزيد في الحزمة أكثر ممّا تفيد، فالرسم هنا: مسارات
 * بـcurrentColor و`stroke`، تكبر وتصغر بحجم النصّ ولا تحتاج تلويناً.
 *
 * الاسم المجهول يرجع مربّعاً فارغاً لا شيئاً: إيكونة ناقصة تُرى فتُصلَح،
 * وفراغٌ لا يُرى يبقى.
 */
export type IconName =
  | 'grid'
  | 'clipboard'
  | 'file'
  | 'helmet'
  | 'layers'
  | 'check-circle'
  | 'chart'
  | 'gear'
  | 'building'
  | 'award'
  | 'hands'
  | 'users'
  | 'box'
  | 'map'
  | 'user'
  | 'folder'
  | 'home'
  | 'calendar'
  | 'camera'
  | 'lock'
  | 'send'
  | 'save'
  | 'download'
  | 'info'
  | 'eye'
  | 'bricks'
  | 'trowel'
  | 'roller'
  | 'coins'
  | 'ruler'
  | 'bed'
  | 'sofa'
  | 'pin'
  | 'briefcase'
  | 'factory'
  | 'store'
  | 'wrench'
  | 'sparkle'

const P: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 3h6v3H9z" />
      <path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
      <path d="M8.5 11h7M8.5 15h4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </>
  ),
  helmet: (
    <>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M9 15V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8" />
      <rect x="2.5" y="15" width="19" height="3.5" rx="1.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.5 20V8M17 20v-9" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10.5 21v-3h3v3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.5 13.5-1 7 4.5-2.5 4.5 2.5-1-7" />
    </>
  ),
  hands: (
    <>
      <path d="M12 20s-7-4.2-7-9a3.6 3.6 0 0 1 7-1.3A3.6 3.6 0 0 1 19 11c0 4.8-7 9-7 9z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8 4v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2.5 6 2.5 6-2.5v15L15 21l-6-2.5L3 21z" />
      <path d="M9 3.5v15M15 6v15" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5h3L8 6h8l1.5 2.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="1.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8.5L2 8.5z" />
    </>
  ),
  save: (
    <>
      <path d="M4 5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M8 4v5h7M8 20v-5h8v5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M4.5 20h15" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  bricks: (
    <>
      <rect x="3" y="5" width="18" height="4.5" rx="1" />
      <rect x="3" y="14.5" width="18" height="4.5" rx="1" />
      <path d="M9 5v4.5M15 5v4.5M6 14.5V19M12 14.5V19M18 14.5V19" />
    </>
  ),
  trowel: (
    <>
      <path d="M3 10.5 10.5 3l4 4L7 14.5z" />
      <path d="m12.5 12.5 4 4M16 15l5 5" />
    </>
  ),
  roller: (
    <>
      <rect x="3.5" y="4" width="13" height="5.5" rx="1.5" />
      <path d="M16.5 6.75h3a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H11a1 1 0 0 0-1 1V15" />
      <rect x="8.5" y="15" width="3" height="6" rx="1" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
    </>
  ),
  bed: (
    <>
      <path d="M3 19v-8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8" />
      <path d="M3 15h18M7 10V7h5v3" />
    </>
  ),
  sofa: (
    <>
      <path d="M5 11V8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M3 12.5a1.5 1.5 0 0 1 3 0V16h12v-3.5a1.5 1.5 0 0 1 3 0V19H3z" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="1.5" />
      <path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18" />
    </>
  ),
  factory: (
    <>
      <path d="M3 20V10l6 3.5V10l6 3.5V7l6 3v10z" />
      <path d="M8 20v-3M13 20v-3M18 20v-3" />
    </>
  ),
  store: (
    <>
      <path d="M4 10v10h16V10" />
      <path d="M3 10 5 4h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  wrench: (
    <>
      <path d="M15.5 3.5a5.5 5.5 0 0 0-5 7.8L3.5 18.3 5.7 20.5l7-7a5.5 5.5 0 0 0 7.8-5l-3.3 3.3-2.8-2.8z" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18 16.5 18.8 19l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
}

export default function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.6,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {P[name] ?? <rect x="4" y="4" width="16" height="16" rx="2" />}
    </svg>
  )
}
