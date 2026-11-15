/**
 * رسوم أنواع المشروع — ملوّنة لا خطّية.
 *
 * الماكيتة تضع في كلّ بطاقة رسماً صغيراً ملوّناً: دارٌ بسقفٍ قرميدي،
 * عمارةٌ بنوافذ ذهبية، مستودعٌ بسقفٍ مسنَّن، محلٌّ بمظلّة مخطّطة. والخطّ
 * الرفيع الرماديّ يقول «أيقونة»، والرسم الملوّن يقول «هذا أنت».
 *
 * والألوان من الهويّة لا من خارجها: الكحلي والذهبي والكريمي، ومعها
 * قرميديٌّ للسقف وأزرقُ رماديٌّ للصناعي — لونان يميّزان ولا يخرجان.
 *
 * ومرسومةٌ هنا لا مجلوبةٌ صوراً: ملفّ صورةٍ لكلّ نوعٍ يعني ستّ طلبات
 * إضافية على شبكةٍ تونسية، ورسمٌ يكبر بلا أن يتشوّش.
 */

const NAVY = '#0E3A5B'
const GOLD = '#D4A15E'
const GOLD_D = '#B27F2C'
const CREAM = '#F4EFE6'
const BRICK = '#C96F4A'
const STEEL = '#8FA6B8'

export type ArtName = 'maison' | 'immobilier' | 'usine' | 'commerce' | 'renovation' | 'autre'

const ART: Record<ArtName, React.ReactNode> = {
  // دار: سقفٌ قرميدي وجدارٌ كريمي وبابٌ كحلي
  maison: (
    <>
      <path d="M6 22 24 9l18 13v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill={CREAM} />
      <path d="M4 23 24 8l20 15-2 2.6L24 12.3 6 25.6z" fill={BRICK} />
      <rect x="20" y="29" width="8" height="13" rx="1" fill={NAVY} />
      <rect x="11" y="27" width="6" height="6" rx="1" fill={GOLD} />
      <rect x="31" y="27" width="6" height="6" rx="1" fill={GOLD} />
    </>
  ),
  // عمارة: كتلتان ونوافذ ذهبية
  immobilier: (
    <>
      <rect x="6" y="16" width="16" height="26" rx="1.5" fill={CREAM} />
      <rect x="23" y="8" width="19" height="34" rx="1.5" fill={NAVY} />
      {[12, 19, 26, 33].map((y) => (
        <g key={y}>
          <rect x="27" y={y} width="5" height="4" rx="0.8" fill={GOLD} />
          <rect x="34" y={y} width="5" height="4" rx="0.8" fill={GOLD} opacity=".75" />
        </g>
      ))}
      {[20, 27, 34].map((y) => (
        <rect key={y} x="10" y={y} width="8" height="4" rx="0.8" fill={GOLD_D} opacity=".55" />
      ))}
    </>
  ),
  // مستودع: سقفٌ مسنَّن وبابٌ عريض
  usine: (
    <>
      <path d="M4 22h40v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill={CREAM} />
      <path d="M4 22 12 13l8 9-8 0zM20 22l8-9 8 9-8 0zM36 22l8-9v9z" fill={STEEL} />
      <rect x="15" y="29" width="18" height="15" rx="1" fill={NAVY} />
      {[18, 22, 26, 30].map((x) => (
        <rect key={x} x={x} y="31" width="2" height="11" fill={CREAM} opacity=".35" />
      ))}
    </>
  ),
  // محلّ: مظلّة مخطّطة وواجهة زجاج
  commerce: (
    <>
      <rect x="7" y="22" width="34" height="20" rx="1.5" fill={CREAM} />
      <path d="M5 14h38l2 8H3z" fill={GOLD} />
      {[9, 17, 25, 33].map((x) => (
        <rect key={x} x={x} y="14" width="4" height="8" fill={BRICK} opacity=".55" />
      ))}
      <rect x="11" y="26" width="11" height="10" rx="1" fill={STEEL} opacity=".5" />
      <rect x="27" y="26" width="9" height="16" rx="1" fill={NAVY} />
    </>
  ),
  // ترميم: دارٌ ومفتاح شدّ
  renovation: (
    <>
      <path d="M5 24 22 11l17 13v17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill={CREAM} />
      <path d="M3 25 22 10l19 15-2 2.6L22 14l-17 13.6z" fill={BRICK} />
      <rect x="11" y="29" width="7" height="6" rx="1" fill={GOLD} />
      <path
        d="M40 25a6 6 0 0 0-8 5.6l-7 7 3.4 3.4 7-7A6 6 0 0 0 42 27l-3.4 3.4-2.8-2.8z"
        fill={NAVY}
      />
    </>
  ),
  // مشروع آخر: خوذة
  autre: (
    <>
      <path d="M8 31a16 16 0 0 1 32 0z" fill={GOLD} />
      <path d="M19 31V17a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14z" fill={GOLD_D} />
      <rect x="5" y="31" width="38" height="6" rx="3" fill={NAVY} />
    </>
  ),
}

export default function ProjectArt({
  name,
  className = 'h-12 w-12',
}: {
  name: ArtName
  className?: string
}) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {ART[name] ?? ART.autre}
    </svg>
  )
}
