/**
 * ما يُعرض بين نقرة الرابط ووصول الصفحة.
 *
 * كلّ صفحات الموقع `force-dynamic`: تُبنى عند كلّ طلب لأنّها تقرأ من
 * القاعدة. بلا هذا الملفّ يبقى المتصفّح على الصفحة القديمة بلا أيّ إشارة،
 * فيظنّ صاحب التليفون أنّ نقرته ضاعت ويعاود النقر. هيكل رماديّ يقول
 * «وصلَت نقرتك، الصفحة جاية».
 *
 * ملفّ واحد هنا يغطّي الأربع عشرة صفحة لأنّه على مستوى التخطيط.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-8 sm:px-5 sm:py-12" aria-hidden="true">
      <div className="h-8 w-2/3 rounded bg-surface-2 sm:h-9 sm:w-1/2" />
      <div className="mt-4 h-4 w-full rounded bg-surface-2" />
      <div className="mt-2 h-4 w-4/5 rounded bg-surface-2" />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded border border-line bg-surface p-4 sm:p-6">
            <div className="h-3 w-14 rounded bg-surface-2" />
            <div className="mt-3 h-5 w-3/4 rounded bg-surface-2" />
            <div className="mt-3 h-3 w-full rounded bg-surface-2" />
            <div className="mt-2 h-3 w-2/3 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
