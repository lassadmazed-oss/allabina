import Link from 'next/link'
import { notFound } from 'next/navigation'
import SitePhotoUpload from '@/components/SitePhotoUpload'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { getChantier, getReportEntries } from '@/lib/chantiers-server'
import { setDirectionPublishAction } from '@/lib/actions/publication'
import { looksPrivate } from '@/lib/publication'
import {
  reviewReportAction,
  saveReportAction,
  setChantierStatusAction,
  submitReportAction,
} from '@/lib/actions/chantiers'
import {
  CHANTIER_AR,
  REPORT_AR,
  lateDays,
  lineProgress,
  submitRefusals,
  type ChantierStatus,
  type SubmitRefusal,
} from '@/lib/site-reports'
import { formatMoney, isolateNumbers } from '@/lib/format'
import Icon, { type IconName } from '@/components/Icon'
import Pill from '@/components/Pill'

export const dynamic = 'force-dynamic'

const input = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm'
const label = 'mb-1.5 block text-sm font-medium'

const REFUSAL_AR: Record<SubmitRefusal, string> = {
  empty: 'التقرير فارغ — اكتب شنوّة تعمل ولّا عمّر كمّية.',
  blocked_without_reason: '«ما تعملش» بلا سبب ما يفيد في شي.',
  no_next_plan: 'برنامج الغد ناقص.',
  no_photo: 'بلا صورة ما يتقدّمش — الحريف يصدّق اللي يشوف.',
}

const STATUSES: ChantierStatus[] = ['preparing', 'running', 'paused', 'delivered', 'stopped']

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return { title: `${decodeURIComponent(code)} — الورشات` }
}

export default async function ChantierPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ d?: string }>
}) {
  await requirePermission('requests.read')
  const [{ code: raw }, sp] = await Promise.all([params, searchParams])
  const code = decodeURIComponent(raw)
  const detail = await getChantier(code)
  if (!detail) notFound()

  const { chantier, lines, entries, reports, progress, byLot } = detail
  const today = new Date().toISOString().slice(0, 10)
  const editDate = sp.d ?? today
  const editing = reports.find((r) => r.reportDate === editDate)
  const locked = editing?.status === 'approved' || editing?.status === 'submitted'
  const editEntries = editing ? await getReportEntries(editing.id) : new Map<string, number>()
  const perLine = lineProgress(lines, entries)
  const late = lateDays(chantier.expectedEnd)
  const pub = {
    clientAt: chantier.clientConsentAt,
    directionAt: chantier.publishApprovedAt,
    isPublic: chantier.isPublic,
  }

  // مسوّدة محفوظة فيها رقم أو بريد: هي سبب الرفض، تُقال بدل أن تُترك صامتة
  const draftIsPrivate =
    !pub.directionAt &&
    (looksPrivate(chantier.publicTitle ?? '') || looksPrivate(chantier.publicSummary ?? ''))

  // «Chef de projet» في الماكيتة B03 — موجود في القاعدة، فيُقال
  const { data: chef } = chantier.chefUserId
    ? await db.from('staff').select('full_name').eq('user_id', chantier.chefUserId).maybeSingle()
    : { data: null }

  const refusals = editing
    ? submitRefusals({
        done: editing.done,
        blocked: editing.blocked,
        blockedReason: editing.blockedReason,
        nextPlan: editing.nextPlan,
        lines: [...editEntries.entries()].map(([devisLineId, qtyDone]) => ({
          devisLineId,
          qtyDone,
        })),
        photos: editing.photos,
      })
    : []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin/chantiers" className="text-sm text-muted hover:text-brand">
        ← الورشات
      </Link>
      <p className="num mt-2 text-xs text-faint">{isolateNumbers(chantier.code)}</p>
      <h1 className="display mt-0.5 text-lg font-semibold">{chantier.clientName ?? '—'}</h1>

      {/* ── التقدّم ── */}
      <section className="mt-4 rounded border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          {progress.pct === null ? (
            <span className="text-sm text-faint">بلا عقد — ما تتحسبش نسبة</span>
          ) : (
            <>
              <span className="num text-2xl font-semibold">
                {isolateNumbers(String(progress.pct))}%
              </span>
              <span className="text-xs text-muted">
                <span className="num">{isolateNumbers(formatMoney(progress.doneValue))}</span> من{' '}
                <span className="num">{isolateNumbers(formatMoney(progress.totalValue))}</span>
              </span>
            </>
          )}
          <span className="ms-auto rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
            {CHANTIER_AR[chantier.status]}
          </span>
        </div>
        {progress.pct !== null && (
          <div className="mt-3 h-2 rounded bg-surface-2">
            <div
              className="h-2 rounded bg-brand"
              style={{ width: `${Math.min(100, progress.pct)}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-xs leading-6 text-faint">
          محسوبة من الكمّيات المنجزة في <b>التقارير المعتمدة وحدها</b>، موزونة بقيمة كلّ سطر.
          {late !== null && late > 0 && (
            <>
              {' '}
              <span className="text-[#a32a24]">
                متأخّرة <span className="num">{isolateNumbers(String(late))}</span> يوم.
              </span>
            </>
          )}
        </p>

        {byLot.length > 0 && (
          <ul className="mt-3 grid gap-1.5">
            {byLot.map((l) => (
              <li key={l.lotCode} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{l.lotNameAr}</span>
                <span className="num text-xs text-muted">
                  {l.pct === null ? '—' : `${isolateNumbers(String(l.pct))}%`}
                </span>
                <span className="h-1.5 w-20 rounded bg-surface-2">
                  <span
                    className="block h-1.5 rounded bg-gold"
                    style={{ width: `${Math.min(100, l.pct ?? 0)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}

        <form action={setChantierStatusAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <input type="hidden" name="code" value={chantier.code} />
          <label className="block">
            <span className="mb-1 block text-xs text-muted">الحالة</span>
            <select name="status" defaultValue={chantier.status} className="rounded border border-line bg-surface px-2 py-1.5 text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CHANTIER_AR[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1 basis-48">
            <span className="mb-1 block text-xs text-muted">السبب (واجب للتوقّف والإلغاء)</span>
            <input
              name="status_note"
              defaultValue={chantier.statusNote ?? ''}
              className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <button type="submit" className="min-h-8 rounded border border-line px-3 text-xs">
            بدّل
          </button>
        </form>
      </section>

      {/* ── تقرير اليوم ── */}
      <section className="mt-5 rounded border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gold">
            <Icon name="clipboard" className="h-[18px] w-[18px]" />
          </span>
          <h2 className="text-sm font-semibold">تقرير يوم</h2>
          {editing && (
            <Pill tone={editing.status === 'approved' ? 'green' : editing.status === 'submitted' ? 'gold' : 'gray'}>
              {REPORT_AR[editing.status]}
            </Pill>
          )}
        </div>

        {/* ── الشريط: الورشة · النهار · شافّ المشروع (الماكيتة B03) ── */}
        <dl className="mt-3 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {(
            [
              { icon: 'helmet' as IconName, k: 'الورشة', v: chantier.code, num: true },
              { icon: 'calendar' as IconName, k: 'النهار', v: editDate, num: true },
              {
                icon: 'user' as IconName,
                k: 'شافّ المشروع',
                v: chef?.full_name ? String(chef.full_name) : 'ما تعيّنش',
                num: false,
              },
            ] as const
          ).map((c) => (
            <div key={c.k} className="flex items-center gap-2.5 bg-surface p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
                <Icon name={c.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <dt className="text-[11px] text-faint">{c.k}</dt>
                <dd className={`truncate text-sm font-medium ${c.num ? 'num' : ''}`}>
                  {c.num ? isolateNumbers(String(c.v)) : c.v}
                </dd>
              </span>
            </div>
          ))}
        </dl>

        {locked ? (
          <p className="mt-2 rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
            {editing?.status === 'approved'
              ? 'هذا التقرير معتمَد — ما عادش يتحرّر. اللي اعتُمد يبقى كيما اعتُمد.'
              : 'التقرير مقدَّم وينتظر الاعتماد.'}
          </p>
        ) : (
          <form action={saveReportAction} className="mt-3 grid gap-3">
            <input type="hidden" name="code" value={chantier.code} />
            <input type="hidden" name="chantier_id" value={chantier.id} />
            <input type="hidden" name="report_date" value={editDate} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={`${label} flex items-center gap-1.5`}><Icon name="sparkle" className="h-4 w-4 text-gold" />الطقس</span>
                <input name="weather" defaultValue={editing?.weather ?? ''} placeholder="صحو · مطر من الصباح" className={input} />
              </label>
              <label className="block">
                <span className={`${label} flex items-center gap-1.5`}><Icon name="calendar" className="h-4 w-4 text-gold" />اللي كان مبرمج</span>
                <input name="planned" defaultValue={editing?.planned ?? ''} className={input} />
              </label>
            </div>

            <label className="block">
              <span className={`${label} flex items-center gap-1.5`}><Icon name="check-circle" className="h-4 w-4 text-gold" />اللي تعمل</span>
              <textarea name="done" rows={2} defaultValue={editing?.done ?? ''} className={input} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={`${label} flex items-center gap-1.5`}><Icon name="info" className="h-4 w-4 text-gold" />اللي ما تعملش</span>
                <input name="blocked" defaultValue={editing?.blocked ?? ''} className={input} />
              </label>
              <label className="block">
                <span className={`${label} flex items-center gap-1.5`}><Icon name="info" className="h-4 w-4 text-gold" />علاش</span>
                <input name="blocked_reason" defaultValue={editing?.blockedReason ?? ''} className={input} />
              </label>
            </div>

            <label className="block">
              <span className={`${label} flex items-center gap-1.5`}><Icon name="send" className="h-4 w-4 text-gold" />قرار مطلوب من الإدارة</span>
              <input name="decision_needed" defaultValue={editing?.decisionNeeded ?? ''} className={input} />
            </label>

            <label className="block">
              <span className={`${label} flex items-center gap-1.5`}><Icon name="calendar" className="h-4 w-4 text-gold" />برنامج الغد</span>
              <textarea name="next_plan" rows={2} defaultValue={editing?.nextPlan ?? ''} className={input} />
            </label>

            {/* ── الكمّيات: هنا تتولّد النسبة ── */}
            <div>
              <h3 className="text-sm font-semibold">الكمّيات المنجزة اليوم</h3>
              <p className="mt-1 text-xs leading-6 text-muted">
                عمّر كان اللي تحرّك اليوم. <b>ما تكتبش نسبة</b> — النسبة تطلع من هنا.
              </p>
              {lines.length === 0 ? (
                <p className="mt-2 text-xs text-faint">الورشة بلا عرض — ما فمّاش أسطر.</p>
              ) : (
                <div className="mt-2 max-h-80 overflow-y-auto rounded border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="sticky top-0 border-b border-line bg-bg p-2 text-start text-xs text-faint">الشغل</th>
                        <th className="sticky top-0 border-b border-line bg-bg p-2 text-start text-xs text-faint">المتعاقد</th>
                        <th className="sticky top-0 border-b border-line bg-bg p-2 text-start text-xs text-faint">منجز لليوم</th>
                        <th className="sticky top-0 border-b border-line bg-bg p-2 text-start text-xs text-faint">اليوم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perLine.map((p) => (
                        <tr key={p.line.id}>
                          <td className="border-b border-line p-2">
                            <span className="block">{p.line.designationAr}</span>
                            <span className="text-xs text-faint">{p.line.lotNameAr}</span>
                          </td>
                          <td className="num border-b border-line p-2 text-xs text-muted">
                            {isolateNumbers(String(p.line.quantity))} {p.line.unit}
                          </td>
                          <td className="num border-b border-line p-2 text-xs">
                            {isolateNumbers(String(p.qtyDone))}
                            {p.overrun && <span className="ms-1 text-[#a32a24]">زيادة</span>}
                          </td>
                          <td className="border-b border-line p-2">
                            <input
                              name={`qty_${p.line.id}`}
                              inputMode="decimal"
                              defaultValue={editEntries.get(p.line.id) ?? ''}
                              className="num w-20 rounded border border-line bg-surface px-2 py-1 text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ملاحظات داخلية: لا تخرج للحريف — وبلا خانة لها تُكتب في
                «ما تعملش» فتصل إليه */}
            <label className="block rounded-xl border border-[#ecdcb8] bg-gold-soft p-3">
              <span className="mb-0.5 flex items-center gap-1.5 text-sm font-medium text-gold">
                <Icon name="lock" className="h-4 w-4" />
                ملاحظات داخلية سرّية
              </span>
              <span className="mb-1.5 block text-xs leading-6 text-ink-soft">
                يشوفها فريق اللَّبنة برك — <b>ما تدخلش في نسخة الحريف</b>.
              </span>
              <textarea
                name="internal_note"
                rows={2}
                defaultValue={editing?.internalNote ?? ''}
                placeholder="مثال: نتفاهمو مع المناول على الرزنامة"
                className={input}
              />
            </label>

            <button type="submit" className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white">
              احفظ المسوّدة
            </button>
          </form>
        )}

        {/* نسخة الحريف: ما يوصلو بالضبط، قبل ما يتبعث */}
        {editing && (
          <div className="mt-4 rounded border border-dashed border-line-strong bg-bg p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name="eye" className="h-4 w-4 text-gold" />
              نسخة الحريف — هاذا اللي يشوفو بعد الاعتماد
            </p>
            <div className="mt-2 rounded border border-line bg-surface p-3 text-sm leading-7">
              <p className="num text-xs text-faint">{isolateNumbers(editing.reportDate)}</p>
              {editing.done ? <p className="mt-1">{editing.done}</p> : null}
              {editing.blocked && (
                <p className="mt-1 text-muted">
                  ما تعملش: {editing.blocked}
                  {editing.blockedReason ? ` — ${editing.blockedReason}` : ''}
                </p>
              )}
              {editing.nextPlan && <p className="mt-1 text-muted">غدوة: {editing.nextPlan}</p>}
              <p className="mt-1 text-xs text-faint">
                <span className="num">{isolateNumbers(String(editing.photos))}</span> صورة
              </p>
            </div>
            <p className="mt-2 text-xs leading-6 text-faint">
              ما يوصلوش: الملاحظات الداخلية · القرار المطلوب من الإدارة · الكمّيات والأسعار.
            </p>
          </div>
        )}

        {/* ── الصور والتقديم ── */}
        {editing && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name="camera" className="h-4 w-4 text-gold" />
              صور الورشة
            </p>
            {editing.status !== 'approved' && (
              <SitePhotoUpload code={chantier.code} reportId={editing.id} />
            )}
            <p className="mt-2 text-xs text-muted">
              <span className="num">{isolateNumbers(String(editing.photos))}</span> صورة.
            </p>

            {editing.status === 'draft' && (
              <div className="mt-3">
                {refusals.length > 0 ? (
                  <ul className="grid gap-1 text-xs text-[#a32a24]">
                    {refusals.map((r) => (
                      <li key={r}>· {REFUSAL_AR[r]}</li>
                    ))}
                  </ul>
                ) : (
                  <form action={submitReportAction}>
                    <input type="hidden" name="code" value={chantier.code} />
                    <input type="hidden" name="id" value={editing.id} />
                    <button type="submit" className="min-h-9 rounded border border-line px-3 text-sm">
                      قدّمو للاعتماد
                    </button>
                  </form>
                )}
              </div>
            )}

            {/*
              نموذجان لا نموذج بزرّين: نموذجٌ معناه يتبدّل حسب أيّ زرّ
              ضُغط يعتمد على تسلسل الزرّ المُرسِل، وهو أهشّ من خانة
              مخفيّة تقول ما تقول.
            */}
            {editing.status === 'submitted' && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <form action={reviewReportAction}>
                  <input type="hidden" name="code" value={chantier.code} />
                  <input type="hidden" name="id" value={editing.id} />
                  <input type="hidden" name="approve" value="1" />
                  <button type="submit" className="min-h-9 rounded bg-brand px-4 text-sm font-semibold text-white">
                    اعتمدو
                  </button>
                </form>

                <form action={reviewReportAction} className="flex flex-1 basis-56 items-end gap-2">
                  <input type="hidden" name="code" value={chantier.code} />
                  <input type="hidden" name="id" value={editing.id} />
                  <input type="hidden" name="approve" value="0" />
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs text-muted">سبب الرفض (واجب)</span>
                    <input
                      name="review_note"
                      required
                      className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button type="submit" className="min-h-9 rounded border border-line px-3 text-sm">
                    ارفضو
                  </button>
                </form>
              </div>
            )}

            {editing.reviewNote && (
              <p className="mt-2 rounded bg-gold-soft px-3 py-2 text-sm leading-7">
                {editing.reviewNote}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── النشر: موافقتان لا واحدة ── */}
      <section className="mt-5 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">نشر المشروع</h2>
        <p className="mt-1 text-sm leading-7 text-muted">
          المشروع خاصّ افتراضياً. <b>ما يتنشرش إلّا بموافقة الحريف واعتماد الإدارة</b> — والقاعدة
          روحها ترفض غير هذا. وسحب أيّ وحدة منهم ينزّلو في نفس اللحظة.
        </p>

        <ul className="mt-3 grid gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className={pub.clientAt ? 'text-[#1d6b45]' : 'text-faint'}>
              {pub.clientAt ? '✓' : '○'}
            </span>
            موافقة الحريف
            <span className="text-xs text-muted">
              {pub.clientAt ? 'وصلت' : 'ما وصلتش — يعطيها من حسابو'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={pub.directionAt ? 'text-[#1d6b45]' : 'text-faint'}>
              {pub.directionAt ? '✓' : '○'}
            </span>
            اعتماد الإدارة
            <span className="text-xs text-muted">{pub.directionAt ? 'تمّ' : 'ما تمّش'}</span>
          </li>
        </ul>

        <form action={setDirectionPublishAction} className="mt-4 grid gap-3">
          <input type="hidden" name="code" value={chantier.code} />
          <input type="hidden" name="approve" value={pub.directionAt ? '0' : '1'} />
          {!pub.directionAt && (
            <>
              <label className="block">
                <span className={label}>عنوان عمومي</span>
                <input
                  name="public_title"
                  defaultValue={chantier.publicTitle ?? ''}
                  placeholder="دار 140 م² في صفاقس"
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>ملخّص عمومي</span>
                <textarea
                  name="public_summary"
                  rows={2}
                  defaultValue={chantier.publicSummary ?? ''}
                  placeholder="هيكل وتشطيب، من الحفر للتسليم."
                  className={input}
                />
                <span className="mt-1 block text-xs text-faint">
                  بلا عنوان دقيق ولا مبالغ ولا صور ناس. نصّ فيه رقم تليفون ولّا بريد ما يتقبلش.
                </span>
              </label>
              {draftIsPrivate && (
                <p className="rounded bg-[#fdeaea] px-3 py-2 text-sm text-[#8a2020]">
                  ما تعتمدش: في النصّ رقم تليفون ولّا بريد. نحّيه وأعاود.
                </p>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={!pub.directionAt && !pub.clientAt}
            className="min-h-9 justify-self-start rounded border border-line px-4 text-sm disabled:opacity-40"
          >
            {pub.directionAt ? 'اسحب اعتماد الإدارة' : 'اعتمد النشر'}
          </button>
          {!pub.directionAt && !pub.clientAt && (
            <p className="text-xs text-muted">النشر مسدود حتّى يوافق الحريف.</p>
          )}
        </form>

        {chantier.isPublic && (
          <p className="mt-3 rounded bg-[#e4f1ea] px-3 py-2 text-sm text-[#1d6b45]">
            معروض في «ورشاتنا».
          </p>
        )}
      </section>

      {/* ── التقارير السابقة ── */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold">التقارير</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-faint">ما ثمّ تقارير بعد.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/chantiers/${encodeURIComponent(chantier.code)}?d=${r.reportDate}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border border-line bg-surface px-3 py-2.5 transition hover:border-line-strong"
                >
                  <span className="num text-sm font-medium">{isolateNumbers(r.reportDate)}</span>
                  <span className="rounded bg-surface-2 px-1.5 text-xs text-muted">
                    {REPORT_AR[r.status]}
                  </span>
                  <span className="flex-1 truncate text-xs text-muted">{r.done ?? '—'}</span>
                  <span className="num text-xs text-faint">
                    {isolateNumbers(String(r.photos))} صور
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
