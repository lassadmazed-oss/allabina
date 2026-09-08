/** نفس المبدأ في اللوحة: صفحاتها تقرأ من القاعدة عند كلّ فتح. */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-5 sm:py-10" aria-hidden="true">
      <div className="h-7 w-52 rounded bg-surface-2" />
      <div className="mt-3 h-4 w-40 rounded bg-surface-2" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded border border-line bg-surface p-4 sm:p-6">
            <div className="h-3 w-24 rounded bg-surface-2" />
            <div className="mt-3 h-7 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded border border-line bg-surface p-4 sm:p-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 border-b border-line py-3 last:border-0">
            <div className="h-4 w-24 rounded bg-surface-2" />
            <div className="h-4 flex-1 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
