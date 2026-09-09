import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

/** أيقونات خطّية بسمك واحد — تتلوّن بـcurrentColor */
const base: P = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IcHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </svg>
)

export const IcBuilding = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
  </svg>
)

export const IcLeaf = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 19c0-8 5-13 14-13-1 9-6 14-14 13z" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
)

export const IcUsers = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 4a3 3 0 0 1 0 6" />
    <path d="M21 20a6 6 0 0 0-5-6" />
  </svg>
)

export const IcPin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </svg>
)

export const IcShield = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

export const IcFlag = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2 4 2 4H5" />
  </svg>
)

/** سهم في اتجاه القراءة — تقلبه ورقة الأنماط في RTL */
export const IcArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
)

export const IcPlay = (p: P) => (
  <svg {...base} {...p} stroke="none">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
)

/** تتبّع الملفّ: لوحة بعلامة صحّ */
export const IcTrack = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1" />
    <path d="M9 13l2 2 4-4" />
  </svg>
)

export const IcChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
