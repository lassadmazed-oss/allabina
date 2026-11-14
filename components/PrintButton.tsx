'use client'

/**
 * زرّ الطباعة.
 *
 * ما نولّدوش PDF في الخادم: مكتبةٌ ثقيلة وخطٌّ عربي يُدمج، ومتصفّح
 * الحريف عنده «احفظ كـPDF» في نافذة الطباعة نفسها. فالصفحة مهيّأة
 * للطباعة، والزرّ يفتحها.
 */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-10 rounded border border-line px-4 text-sm font-semibold print:hidden"
    >
      {label}
    </button>
  )
}
