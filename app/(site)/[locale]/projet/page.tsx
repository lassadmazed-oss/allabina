import type { Metadata } from 'next'
import Link from 'next/link'
import PhoneGate from '@/components/PhoneGate'
import SketchPlan from '@/components/SketchPlan'
import { recordEvent } from '@/lib/analytics-server'
import { budgetReach, configFromParams } from '@/lib/budget-server'
import { neededFor, type Coverage } from '@/lib/budget-reach'
import { sketchOf } from '@/lib/sketch'
import { getDelegations } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/user-session'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { THIN_NBSP, formatMoney, isolateNumbers } from '@/lib/format'
import Icon, { type IconName } from '@/components/Icon'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').projet
  return { title: t.pageTitle }
}

/**
 * أنواع المسار ليست أنواع المطلب: المسار يسأل بلغة الحريف («دار»)،
 * والقاعدة تخزّن بلغتها («build_on_land»). وبلا هذا الربط كان يصل
 * «maison» إلى الاستمارة فلا تعرفه، وتقع على مسوّدة قديمة.
 */
const TO_REQUEST: Record<string, string> = {
  maison: 'build_on_land',
  renovation: 'renovation',
  immobilier: 'other',
  usine: 'other',
  commerce: 'other',
  autre: 'other',
}

const LOT_AR: Record<number, string> = {
  10: 'الفرش والتغطية',
  11: 'الألمنيوم',
  12: 'النجارة الخشبية',
  14: 'الدهن',
}

const TYPES = ['maison', 'immobilier', 'usine', 'commerce', 'renovation', 'autre'] as const

/**
 * إيكونة لكلّ نوع — الماكيتة F01/F02.
 *
 * ستّ بطاقات بيضاء بلا علامة تُقرأ قائمةً نصّية: العين تمرّ عليها سطراً
 * سطراً بدل أن تلتقط «دار» من شكلها. والإيكونة هنا تمييزٌ لا تزيين.
 */
const TYPE_ICON: Record<(typeof TYPES)[number], IconName> = {
  maison: 'home',
  immobilier: 'building',
  usine: 'factory',
  commerce: 'store',
  renovation: 'wrench',
  autre: 'sparkle',
}
const field = 'w-full rounded border border-line bg-surface px-3 py-2.5'

/**
 * كوّن مشروعك — أربع خطوات.
 *
 * الحالة في العنوان لا في ذاكرة المتصفّح: المسار يشتغل بلا جافاسكريبت،
 * ويُنسَخ ويُرسَل ويُفتح من جديد كما تُرك. والرجوع للتعديل رابطٌ لا زرّ.
 *
 * والخطوة الرابعة لا تكتب مطلباً: تسلّم إلى الاستمارة الموجودة. طريقان
 * يكتبان نفس الجدول بتحقّقين مختلفين يفترقان بعد شهر، ويبقى أحدهما
 * بلا الفحص الذي أُضيف للآخر.
 */
export default async function ProjetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.projet

  const step = Math.min(4, Math.max(1, Math.round(Number(sp.e ?? 1)) || 1))
  const type = TYPES.includes(sp.type as never) ? (sp.type as string) : ''
  const config = configFromParams(sp)
  const budget = Number(String(sp.b ?? '').replace(/[\s,]/g, ''))
  const hasBudget = Number.isFinite(budget) && budget > 0

  if (step === 1) await recordEvent('trial_start', { projectType: type || null })

  /*
   * الرسم والتقدير خلف حساب متثبَّت منه — قرار الواجهة (F02):
   * «Aucune esquisse ni estimation sans compte vérifié».
   * الخطوة الأولى مفتوحة: الاختيار يسبق الحساب، فمن لا يعرف ما يريد
   * لا يُطلب منه رقمه.
   */
  const user = step >= 2 ? await getCurrentUser() : null
  const needsAccount = step >= 2 && !user

  const delegations = await getDelegations('SFX')
  const sketch = step >= 2 ? sketchOf(config) : null
  const answer = step >= 3 && hasBudget ? await budgetReach(config, budget) : null

  /** العنوان مع ما جُمع حتّى الآن */
  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | number | undefined> = {
      type,
      s: config.surface,
      l: config.levels,
      ch: config.bedrooms,
      sa: config.livingRooms,
      cu: config.kitchens,
      sdb: config.bathrooms,
      del: sp.del,
      tr: sp.tr,
      bank: sp.bank,
      b: hasBudget ? budget : undefined,
      ...over,
    }
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined && v !== '' && v !== null) p.set(k, String(v))
    }
    return `/${locale}/projet?${p.toString()}`
  }

  /** الخانات المخفيّة التي تحمل ما سبق إلى الخطوة التالية */
  const carry = (keys: string[]) => (
    <>
      {keys.map((k) => {
        const v: Record<string, string | number | undefined> = {
          type,
          s: config.surface,
          l: config.levels,
          ch: config.bedrooms,
          sa: config.livingRooms,
          cu: config.kitchens,
          sdb: config.bathrooms,
          del: sp.del,
          tr: sp.tr,
          bank: sp.bank,
          b: hasBudget ? budget : undefined,
        }
        return v[k] === undefined ? null : (
          <input key={k} type="hidden" name={k} value={String(v[k])} />
        )
      })}
    </>
  )

  const delegName = delegations.find((d) => String(d.id) === String(sp.del))?.name_ar ?? null
  const STATE_AR: Record<Coverage, string> = {
    full: dict.budget.done,
    partial: dict.budget.partial,
    none: dict.budget.notStarted,
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      {/* ── المؤشّر: ✓ للمنجز، رقمٌ للجاي، وخطٌّ يربط (الماكيتة F03) ── */}
      <ol className="flex items-start">
        {t.steps.map((label, i) => {
          const n = i + 1
          const done = n < step
          const now = n === step
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col items-center">
              <span className="flex w-full items-center">
                <span
                  className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done || now ? 'bg-brand' : 'bg-line'}`}
                />
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] transition ${
                    done || now ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-faint'
                  }`}
                >
                  {done ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    <span className="num">{isolateNumbers(String(n))}</span>
                  )}
                </span>
                <span
                  className={`h-0.5 flex-1 ${i === t.steps.length - 1 ? 'opacity-0' : done ? 'bg-brand' : 'bg-line'}`}
                />
              </span>
              <span
                className={`mt-1.5 truncate px-1 text-[11px] sm:text-xs ${now ? 'font-semibold text-ink' : 'text-muted'}`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* ── 1 · المشروع ── */}
      {step === 1 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q1}</h1>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map((k) => (
              <li key={k}>
                <Link
                  href={href({ type: k, e: 2 })}
                  className={`relative flex h-full flex-col items-center rounded-xl border-2 p-4 text-center transition hover:border-line-strong ${
                    type === k ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
                  }`}
                >
                  {type === k && (
                    <span
                      className="absolute top-2.5 grid size-5 place-items-center rounded-full bg-brand text-white"
                      style={{ insetInlineEnd: '0.625rem' }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                  <span
                    className={`grid size-12 place-items-center rounded-xl ${
                      type === k ? 'bg-brand text-white' : 'bg-gold-soft text-gold'
                    }`}
                  >
                    <Icon name={TYPE_ICON[k]} className="h-6 w-6" />
                  </span>
                  <span className="mt-2.5 font-semibold">{t.types[k]}</span>
                  <span className="mt-0.5 text-sm leading-6 text-muted">{t.typeHint[k]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── الحساب قبل الرسم والتقدير ── */}
      {needsAccount && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.gateTitle}</h1>
          <p className="mt-2 leading-8 text-muted">{t.gateBody}</p>
          {type && (
            <p className="mt-3 text-sm text-muted">
              {t.summaryType}: <b className="text-ink">{t.types[type]}</b> · {t.gateKeep}
            </p>
          )}
          <div className="mt-7 max-w-sm">
            <PhoneGate
              locale={locale}
              t={dict.account}
              next={href({}).replace(/^https?:\/\/[^/]+/, '')}
            />
          </div>
          <Link
            href={href({ e: 1 })}
            className="mt-6 inline-block text-sm text-muted underline underline-offset-4"
          >
            {t.back}
          </Link>
        </section>
      )}

      {/* ── 2 · الحاجة ── */}
      {!needsAccount && step === 2 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q2}</h1>

          <form action={`/${locale}/projet`} className="mt-6 grid gap-4">
            <input type="hidden" name="e" value="2" />
            {carry(['type', 'bank'])}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.where}</span>
                <select name="del" defaultValue={sp.del ?? ''} className={field}>
                  <option value="">—</option>
                  {delegations.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name_ar}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.surface}</span>
                <input
                  name="s"
                  inputMode="numeric"
                  defaultValue={config.surface}
                  className={`num ${field}`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.terrain}</span>
                <select name="tr" defaultValue={sp.tr ?? 'empty'} className={field}>
                  {Object.entries(t.terrainOpts).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.levels}</span>
                <input name="l" inputMode="numeric" defaultValue={config.levels} className={`num ${field}`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.bedrooms}</span>
                <input name="ch" inputMode="numeric" defaultValue={config.bedrooms} className={`num ${field}`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.livingRooms}</span>
                <input name="sa" inputMode="numeric" defaultValue={config.livingRooms} className={`num ${field}`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t.bathrooms}</span>
                <input name="sdb" inputMode="numeric" defaultValue={config.bathrooms} className={`num ${field}`} />
              </label>
            </div>

            <button type="submit" className="min-h-11 justify-self-start rounded border border-line px-5 text-sm font-semibold">
              {t.redraw}
            </button>
          </form>

          {/* الرسم: توزيع مساحات لا مخطّط */}
          <div className="mt-6">
            {sketch?.fits ? (
              <>
                <SketchPlan sketch={sketch} surface={config.surface} caption={t.sketchCaption} />
                {sketch.tight && (
                  <p className="mt-2 rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
                    {t.tight}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded border border-line bg-gold-soft px-4 py-3 text-sm leading-7">
                <b>{t.doesntFit}</b>
                {sketch && !sketch.fits && sketch.needed > 0 && (
                  <>
                    {' '}
                    {t.needs}{' '}
                    <b className="num">{isolateNumbers(String(sketch.needed))}</b> م².
                  </>
                )}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={href({ e: 1 })} className="text-sm text-muted underline underline-offset-4">
              {t.back}
            </Link>
            {sketch?.fits && (
              <Link
                href={href({ e: 3 })}
                className="ms-auto rounded bg-brand px-5 py-3 font-semibold text-white"
              >
                {t.next}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── 3 · الميزانية ── */}
      {!needsAccount && step === 3 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q3}</h1>

          <form action={`/${locale}/projet`} className="mt-6 flex flex-wrap items-end gap-3">
            <input type="hidden" name="e" value="3" />
            {carry(['type', 's', 'l', 'ch', 'sa', 'cu', 'sdb', 'del'])}
            <label className="block flex-1 basis-56">
              <span className="mb-1.5 block text-sm font-medium">{dict.budget.amount}</span>
              <input
                name="b"
                inputMode="numeric"
                defaultValue={hasBudget ? String(budget) : ''}
                placeholder={`30${THIN_NBSP}000`}
                required
                className={`num ${field} text-lg`}
              />
            </label>
            <button type="submit" className="min-h-11 rounded border border-line px-5 text-sm font-semibold">
              {dict.budget.submit}
            </button>
          </form>

          {answer && (
            <div className="mt-6">
              <div className="rounded border border-line bg-surface p-5">
                {answer.reach.complete ? (
                  <p className="text-lg font-semibold leading-8">{dict.budget.complete}</p>
                ) : answer.reach.stopAt ? (
                  <p className="text-lg leading-9">
                    <span className="text-muted">{dict.budget.answerTitle}</span>{' '}
                    <b>
                      {answer.reach.stages
                        .filter((s) => s.state === 'full')
                        .map((s) => (locale === 'fr' ? s.nameFr : s.nameAr))
                        .join(' · ') || '—'}
                    </b>
                    {' — '}
                    <span className="text-muted">{dict.budget.stopAt}</span>{' '}
                    <b>
                      {locale === 'fr' ? answer.reach.stopAt.nameFr : answer.reach.stopAt.nameAr}
                    </b>{' '}
                    <span className="num text-brand">
                      {isolateNumbers(String(answer.reach.stopAt.pct))}%
                    </span>
                  </p>
                ) : (
                  <p className="leading-8">{dict.budget.nothing}</p>
                )}
              </div>

              <ul className="mt-4 grid gap-2">
                {answer.reach.stages.map((s) => {
                  const gap = s.state === 'partial' ? neededFor(answer.reach, s.key) : null
                  return (
                    <li
                      key={s.key}
                      className={`rounded border p-3 ${
                        s.state === 'none' ? 'border-dashed border-line bg-bg' : 'border-line bg-surface'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium">{locale === 'fr' ? s.nameFr : s.nameAr}</span>
                        <span
                          className={`rounded px-1.5 text-xs ${
                            s.state === 'full'
                              ? 'bg-[#e4f1ea] text-[#1d6b45]'
                              : s.state === 'partial'
                                ? 'bg-gold-soft text-gold'
                                : 'bg-surface-2 text-muted'
                          }`}
                        >
                          {STATE_AR[s.state]}
                          {s.state === 'partial' && (
                            <>
                              {' '}
                              <span className="num">{isolateNumbers(String(s.pct))}</span>%
                            </>
                          )}
                        </span>
                        <span className="num ms-auto text-sm text-muted">
                          {isolateNumbers(formatMoney(s.cost, locale))}
                        </span>
                      </div>
                      {gap !== null && (
                        <p className="mt-1.5 text-xs leading-6 text-muted">
                          {dict.budget.needed}{' '}
                          <b className="num text-ink">{isolateNumbers(formatMoney(gap, locale))}</b>
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>

              <p className="mt-4 rounded border border-line bg-gold-soft p-3 text-sm leading-7">
                <b>{dict.budget.notQuote}</b>
              </p>
              <p className="mt-2 text-xs leading-7 text-faint">{dict.budget.how}</p>
            </div>
          )}

          {/* الكاتالوج كفكرة لا كقرار: اختيار المواد يجي بعد الدراسة */}
          <section className="mt-7 rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">{t.finishes}</h2>
            <p className="mt-0.5 text-xs leading-6 text-faint">{t.finishesHint}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[10, 14, 11, 12].map((lot) => (
                <li key={lot}>
                  <Link
                    href={`/${locale}/catalogue?lot=${lot}`}
                    className="inline-block rounded border border-line px-3 py-1.5 text-sm text-muted transition hover:border-line-strong"
                  >
                    {LOT_AR[lot]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <form action={`/${locale}/projet`} className="mt-4">
            <input type="hidden" name="e" value="3" />
            {carry(['type', 's', 'l', 'ch', 'sa', 'cu', 'sdb', 'del', 'tr', 'b'])}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="bank"
                value="1"
                defaultChecked={sp.bank === '1'}
                className="size-4"
              />
              {t.bank}
            </label>
            <button type="submit" className="mt-2 text-xs text-muted underline underline-offset-4">
              {dict.budget.submit}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={href({ e: 2 })} className="text-sm text-muted underline underline-offset-4">
              {t.back}
            </Link>
            {answer && (
              <Link
                href={href({ e: 4 })}
                className="ms-auto rounded bg-brand px-5 py-3 font-semibold text-white"
              >
                {t.next}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── 4 · الملخّص ── */}
      {!needsAccount && step === 4 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q4}</h1>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {sketch?.fits && (
              <SketchPlan sketch={sketch} surface={config.surface} caption={t.sketchCaption} />
            )}
            <dl className="grid content-start gap-3">
              {type && (
                <div>
                  <dt className="text-xs text-faint">{t.summaryType}</dt>
                  <dd className="mt-0.5 font-medium">{t.types[type]}</dd>
                </div>
              )}
              {delegName && (
                <div>
                  <dt className="text-xs text-faint">{t.summaryWhere}</dt>
                  <dd className="mt-0.5 font-medium">{delegName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-faint">{t.summarySurface}</dt>
                <dd className="num mt-0.5 font-medium">
                  {isolateNumbers(String(config.surface))} م²
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">{t.summaryRooms}</dt>
                <dd className="mt-0.5 font-medium">
                  <span className="num">{isolateNumbers(String(config.bedrooms))}</span>{' '}
                  {t.roomsShort} ·{' '}
                  <span className="num">{isolateNumbers(String(config.bathrooms))}</span>{' '}
                  {t.bathsShort}
                </dd>
              </div>
              {sp.tr && t.terrainOpts[sp.tr] && (
                <div>
                  <dt className="text-xs text-faint">{t.terrain}</dt>
                  <dd className="mt-0.5 font-medium">{t.terrainOpts[sp.tr]}</dd>
                </div>
              )}
              {hasBudget && (
                <div>
                  <dt className="text-xs text-faint">{t.summaryBudget}</dt>
                  <dd className="num mt-0.5 font-medium">
                    {isolateNumbers(formatMoney(budget, locale))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {answer && answer.reach.stopAt && (
            <p className="mt-5 rounded border border-line bg-surface px-4 py-3 leading-8">
              <span className="text-muted">{dict.budget.answerTitle}</span>{' '}
              <b>
                {answer.reach.stages
                  .filter((s) => s.state === 'full')
                  .map((s) => (locale === 'fr' ? s.nameFr : s.nameAr))
                  .join(' · ') || '—'}
              </b>
              {' — '}
              <span className="text-muted">{dict.budget.stopAt}</span>{' '}
              <b>{locale === 'fr' ? answer.reach.stopAt.nameFr : answer.reach.stopAt.nameAr}</b>{' '}
              <span className="num text-brand">
                {isolateNumbers(String(answer.reach.stopAt.pct))}%
              </span>
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={href({ e: 3 })} className="text-sm text-muted underline underline-offset-4">
              {t.back}
            </Link>
            <Link
              href={`/${locale}/demande?${new URLSearchParams(
                Object.entries({
                  type: TO_REQUEST[type] ?? '',
                  s: String(config.surface),
                  l: String(config.levels),
                  ch: String(config.bedrooms),
                  sa: String(config.livingRooms),
                  cu: String(config.kitchens),
                  sdb: String(config.bathrooms),
                  del: sp.del ?? '',
                }).filter(([, v]) => v) as [string, string][]
              ).toString()}`}
              className="ms-auto rounded bg-brand px-6 py-3 font-semibold text-white"
            >
              {t.send}
            </Link>
          </div>
          <p className="mt-3 text-xs leading-7 text-faint">{t.sendHint}</p>

          <Link
            href={`/${locale}/projet`}
            className="mt-6 inline-block text-sm text-muted underline underline-offset-4"
          >
            {t.startOver}
          </Link>
        </section>
      )}
    </div>
  )
}
