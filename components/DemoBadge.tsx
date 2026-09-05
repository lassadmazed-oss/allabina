/**
 * شارة «بيانات تجريبية».
 *
 * الحالات المعروضة في الصفحات العمومية تخصّ ناساً. حالة مخترعة بلا وسم
 * كذبة على الزائر، حتّى لو كانت النيّة عرض المنصّة. الوسم في القاعدة
 * (is_demo) وهذي الشارة هي وجهه في الواجهة.
 */
export default function DemoBadge({ label }: { label: string }) {
  return (
    <span className="ms-2 inline-block rounded border border-gold/40 bg-gold-soft px-2 py-0.5 align-middle text-xs font-normal text-gold">
      {label}
    </span>
  )
}
