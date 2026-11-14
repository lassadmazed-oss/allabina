import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import ArticleMediaUpload from '@/components/ArticleMediaUpload'
import { deleteArticleMediaAction } from '@/lib/actions/article-media'
import { updateArticleCardAction } from '@/lib/actions/catalog'
import { ARTICLE_MEDIA_BUCKET, isPublishable, sortMedia } from '@/lib/article-media'
import { formatSpecs } from '@/lib/catalog'
import { formatMoney, isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بطاقة مقال — اللَّبنة' }

const AVAILABILITY = [
  ['in_stock', 'متوفّر'],
  ['on_order', 'على الطلب'],
  ['on_survey', 'يُحدَّد بعد المعاينة'],
] as const

export default async function AdminArticlePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  await requirePermission('reference.manage')
  const { code: raw } = await params
  const code = decodeURIComponent(raw)

  type Lot = { code: number; name_ar: string }
  const { data: row } = await db
    .from('articles')
    .select(
      'id, code, designation_ar, designation_fr, description, description_fr, unit, ' +
        'pu_fourniture_ht, pu_main_oeuvre_ht, availability, lead_time_days, specs, ' +
        'installation_note, usage_note, is_public, lots(code, name_ar)'
    )
    .eq('code', code)
    .maybeSingle()
  if (!row) notFound()

  // سلسلة select مركّبة لا يستنتجها supabase-js، فالتشكيل هنا بيدنا
  const a = row as unknown as Record<string, unknown> & { lots?: Lot | Lot[] | null }
  const lot = Array.isArray(a.lots) ? a.lots[0] : a.lots
  const priceHt = Number(a.pu_fourniture_ht ?? 0) + Number(a.pu_main_oeuvre_ht ?? 0)

  const { data: mediaRows } = await db
    .from('article_media')
    .select('id, storage_path, alt_ar, credit, license, sort_order')
    .eq('article_id', a.id)
    .order('sort_order')

  const media = sortMedia(
    (mediaRows ?? []).map((m) => ({
      id: Number(m.id),
      storagePath: String(m.storage_path),
      altAr: (m.alt_ar as string) ?? null,
      altFr: null,
      credit: (m.credit as string) ?? null,
      license: (m.license as string) ?? null,
      sortOrder: Number(m.sort_order),
    }))
  )

  const signed = media.length
    ? (await db.storage.from(ARTICLE_MEDIA_BUCKET).createSignedUrls(media.map((m) => m.storagePath), 3600)).data
    : []
  const urlByPath = new Map((signed ?? []).map((s) => [String(s.path), s.signedUrl]))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin/bordereau" className="text-sm text-muted hover:text-brand">
        ← البوردرو
      </Link>

      <p className="num mt-3 text-xs text-faint">{isolateNumbers(String(a.code))}</p>
      <h1 className="display mt-1 text-lg font-semibold">{String(a.designation_ar)}</h1>
      <p className="mt-1 text-sm text-muted">
        {lot?.name_ar} · <span className="num">{isolateNumbers(String(a.unit))}</span> ·{' '}
        <span className="num">{isolateNumbers(formatMoney(priceHt, 'ar'))}</span> بلا أداء
        {a.is_public ? (
          <span className="ms-2 rounded bg-[#e4f1ea] px-2 py-0.5 text-xs text-[#1d6b45]">منشور</span>
        ) : (
          <span className="ms-2 rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">غير منشور</span>
        )}
      </p>
      <p className="mt-2 text-xs leading-7 text-faint">
        السعر يتبدّل من البوردرو مع صيغة الكمّية. هنا ما يراه الزائر ولا يُحسب منه سعر.
      </p>

      {/* ── بطاقة العرض ── */}
      <form action={updateArticleCardAction} className="mt-6 grid gap-4 rounded border border-line bg-surface p-4">
        <input type="hidden" name="code" value={String(a.code)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">التوفّر</span>
            <select
              name="availability"
              defaultValue={String(a.availability ?? 'on_order')}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              {AVAILABILITY.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-faint">
              «بعد المعاينة» تُخفي السعر ولا تعرضه صفراً.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">أجل التوريد (يوم)</span>
            <input
              name="lead_time_days"
              type="number"
              min={0}
              max={365}
              defaultValue={a.lead_time_days === null ? '' : String(a.lead_time_days)}
              className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">الوصف (عربي)</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={(a.description as string) ?? ''}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Description (français)</span>
          <textarea
            name="description_fr"
            rows={3}
            dir="ltr"
            defaultValue={(a.description_fr as string) ?? ''}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">المواصفات</span>
          <textarea
            name="specs"
            rows={4}
            defaultValue={formatSpecs(a.specs as Record<string, string> | null)}
            placeholder={'المقاس: 20×20×40 صم\nالمقاومة: 60 بار\nاللون: رمادي'}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-faint">سطر لكلّ مواصفة: «المفتاح: القيمة».</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">يشمل التركيب</span>
            <textarea
              name="installation_note"
              rows={2}
              defaultValue={(a.installation_note as string) ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">شروط الاستعمال</span>
            <textarea
              name="usage_note"
              rows={2}
              defaultValue={(a.usage_note as string) ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button type="submit" className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white">
          احفظ البطاقة
        </button>
      </form>

      {/* ── الصور ── */}
      <section className="mt-6 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">الصور وحقوقها</h2>

        {media.length > 0 && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {media.map((m) => {
              const url = urlByPath.get(m.storagePath)
              const ok = isPublishable(m)
              return (
                <li key={m.id} className="rounded border border-line p-2">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={m.altAr ?? ''} className="aspect-[4/3] w-full rounded object-cover" />
                  )}
                  <p className="mt-2 text-xs text-muted">{m.credit ?? '—'}</p>
                  <p className="text-xs text-faint">{m.license ?? '—'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${ok ? 'bg-[#e4f1ea] text-[#1d6b45]' : 'bg-[#fae9e8] text-[#a32a24]'}`}
                    >
                      {ok ? 'تظهر للزائر' : 'بلا إذن — ما تظهرش'}
                    </span>
                    <form action={deleteArticleMediaAction}>
                      <input type="hidden" name="media_id" value={m.id} />
                      <input type="hidden" name="code" value={String(a.code)} />
                      <button type="submit" className="text-xs text-[#a32a24] underline underline-offset-4">
                        حذف
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <ArticleMediaUpload code={String(a.code)} />
        </div>
      </section>
    </div>
  )
}
