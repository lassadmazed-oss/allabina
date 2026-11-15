import type { Metadata } from 'next'
import Link from 'next/link'
import ProjectSend from '@/components/ProjectSend'
import SketchPlan from '@/components/SketchPlan'
import { recordEvent } from '@/lib/analytics-server'
import { budgetReach, configFromParams } from '@/lib/budget-server'
import { SCOPES, neededFor, parseScope, type Coverage } from '@/lib/budget-reach'
import { sketchOf } from '@/lib/sketch'
import { db, getConstructionSystems, getDelegations } from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { THIN_NBSP, formatMoney, isolateNumbers } from '@/lib/format'
import Icon, { type IconName } from '@/components/Icon'
import ProjectTypeCards, { projectTypeIcon } from '@/components/ProjectTypeCards'
import ChoiceCards, { FieldRow } from '@/components/ChoiceCards'
import NumberStepper from '@/components/NumberStepper'
import { Check } from '@/components/ProjectTypeCards'
import {
  asksRooms,
  asksSpan,
  asksUnits,
  drawsSketch,
  kindOfType,
  parseKind,
  typesFor,
} from '@/lib/project-kind'

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



const TYPES = ['maison', 'immobilier', 'usine', 'commerce', 'renovation', 'autre'] as const

const field = 'w-full rounded border border-line bg-surface px-3 py-2.5'

/** إيكونة لكلّ لوط تشطيب — بأرقام اللوطات كما في البوردرو */
const FINISH_ICON: Record<number, IconName> = {
  10: 'layers',
  11: 'ruler',
  12: 'box',
  13: 'wrench',
  14: 'roller',
  15: 'store',
  16: 'layers',
  17: 'sparkle',
}

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
  // فرد أم محترف (الماكيتة F02). الرابط الذي يحمل النوع وحده يُنسب لصنفه
  const kind = sp.k ? parseKind(sp.k) : type ? kindOfType(type) : parseKind(undefined)
  const kindTypes = typesFor(kind)
  const rooms = asksRooms(type)
  const scope = parseScope(sp.sc)
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
  /*
   * لا حاجز. قرار 15/11/2026: «يدخل، يعمّر، يشوف، يختار — وفي آخر
   * مرحلة يعطي اسمه ورقمه ويبعث». الحاجز في النصّ يخسر من لم يرَ بعدُ
   * قيمةً، والرسالة لا تُدفع إلّا عند مطلبٍ حقيقي.
   */

  const [delegations, systems, finishLots] = await Promise.all([
    getDelegations('SFX'),
    getConstructionSystems(),
    // لوطات التشطيب الحقيقية (10→17) — لا قائمةٌ مكتوبة في الشفرة
    step === 3 && scope === 'finish'
      ? db
          .from('lots')
          .select('code, name_ar, name_fr')
          .gte('code', 10)
          .lte('code', 17)
          .order('code')
      : Promise.resolve({ data: [] as { code: number; name_ar: string; name_fr: string }[] }),
  ])
  const finishes = (sp.fin ?? '').split(',').filter(Boolean)
  const sketch = step >= 2 && drawsSketch(type) ? sketchOf(config) : null
  const answer = step >= 3 && hasBudget ? await budgetReach(config, budget, scope) : null

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
      k: kind,
      sc: scope,
      fin: sp.fin,
      u: sp.u,
      h: sp.h,
      sp: sp.sp,
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
                    <Check />
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

          {/* ── فرد | محترف (الماكيتة F02): من يبني داراً لا يُسأل كمن يبني عمارة ── */}
          <div className="mt-5 inline-flex rounded-xl border border-line bg-surface p-1">
            {(['particulier', 'pro'] as const).map((k) => (
              <Link
                key={k}
                href={href({ k, type: '', e: 1 })}
                aria-current={kind === k ? 'true' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
                  kind === k ? 'bg-brand text-white' : 'text-muted hover:text-brand'
                }`}
              >
                <Icon name={k === 'pro' ? 'briefcase' : 'user'} className="h-4 w-4" />
                {t.kinds[k]}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs leading-6 text-faint">{t.kindHint[kind]}</p>

          <div className="mt-5">
            <ProjectTypeCards
              names={t.types}
              hints={t.typeHint}
              selected={type}
              types={kindTypes}
              hrefOf={(k) => href({ type: k, e: 2 })}
            />
          </div>
        </section>
      )}

      {/* ── 2 · الحاجة ── */}
      {step === 2 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q2}</h1>

          <form action={`/${locale}/projet`} className="mt-6 grid gap-4">
            <input type="hidden" name="e" value="2" />
            {carry(['type', 'bank', 'sys', 'k'])}

            {/* صفوف بإيكوناتها كما في الماكيتة F02 */}
            <div className="grid gap-3">
              <FieldRow icon="pin" label={t.where}>
                <select name="del" defaultValue={sp.del ?? ''} className={field}>
                  <option value="">—</option>
                  {delegations.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name_ar}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow icon="ruler" label={t.surface}>
                <input
                  name="s"
                  inputMode="numeric"
                  defaultValue={config.surface}
                  className={`num ${field}`}
                />
              </FieldRow>
              <FieldRow icon="layers" label={t.terrain}>
                <select name="tr" defaultValue={sp.tr ?? 'empty'} className={field}>
                  {Object.entries(t.terrainOpts).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>

            {/*
              السؤال يتبع المشروع لا الصنف: من يبني داراً يُسأل عن غرفه،
              ومن يبني عمارةً يُسأل عن شققها، ومن يبني مستودعاً عن ارتفاعه.
              ورسمُ صالونٍ لمستودعٍ ليس تقريباً بل جواب عن سؤالٍ لم يُطرح.
            */}
            <div className="grid gap-3">
              <FieldRow icon="layers" label={t.levels}>
                <NumberStepper name="l" defaultValue={config.levels} min={1} max={6} />
              </FieldRow>

              {rooms && (
                <>
                  <FieldRow icon="bed" label={t.bedrooms}>
                    <NumberStepper name="ch" defaultValue={config.bedrooms} min={0} max={20} />
                  </FieldRow>
                  <FieldRow icon="sofa" label={t.livingRooms}>
                    <NumberStepper name="sa" defaultValue={config.livingRooms} min={0} max={6} />
                  </FieldRow>
                  <FieldRow icon="roller" label={t.bathrooms}>
                    <NumberStepper name="sdb" defaultValue={config.bathrooms} min={0} max={10} />
                  </FieldRow>
                </>
              )}

              {asksUnits(type) && (
                <FieldRow icon="building" label={type === 'immobilier' ? t.unitsFlats : t.unitsShops}>
                  <NumberStepper name="u" defaultValue={Number(sp.u ?? 0)} min={0} max={200} />
                </FieldRow>
              )}

              {asksSpan(type) && (
                <>
                  <FieldRow icon="ruler" label={t.height}>
                    <input name="h" inputMode="decimal" defaultValue={sp.h ?? ''} placeholder="—" className={`num ${field}`} />
                  </FieldRow>
                  <FieldRow icon="ruler" label={t.span}>
                    <input name="sp" inputMode="decimal" defaultValue={sp.sp ?? ''} placeholder="—" className={`num ${field}`} />
                  </FieldRow>
                </>
              )}
            </div>

            {/* ── كيفاش تبني: طرق البناء من القاعدة لا من قائمة في الشفرة ── */}
            {systems.length > 0 && (
              <fieldset className="mt-1">
                <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="bricks" className="h-4 w-4 text-gold" />
                  {t.method}
                </legend>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {systems.map((sys) => {
                    const on = (sp.sys ?? systems[0].code) === sys.code
                    return (
                      <li key={sys.code}>
                        <label
                          className={`flex h-full cursor-pointer gap-2.5 rounded-xl border-2 p-3 transition ${
                            on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong'
                          }`}
                        >
                          <input
                            type="radio"
                            name="sys"
                            value={sys.code}
                            defaultChecked={on}
                            className="mt-1 size-4 shrink-0 accent-[#0e3a5b]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {locale === 'fr' ? sys.name_fr || sys.name_ar : sys.name_ar}
                            </span>
                            <span className="mt-0.5 block text-xs leading-6 text-muted">
                              {(locale === 'fr'
                                ? sys.citizen_summary_fr || sys.citizen_summary_ar
                                : sys.citizen_summary_ar) ?? ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-xs leading-6 text-faint">{t.methodHint}</p>
              </fieldset>
            )}

            {/* ── نطاق الأشغال (الماكيتة F02/F03): لوين نمشيو معاك ── */}
            <fieldset className="mt-1">
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Icon name="trowel" className="h-4 w-4 text-gold" />
                {t.scopeTitle}
              </legend>
              <ChoiceCards
                columns={3}
                selected={scope}
                choices={SCOPES.map((k) => ({
                  key: k,
                  label: t.scopes[k],
                  hint: t.scopeHint[k],
                  icon: (k === 'structure' ? 'bricks' : k === 'second' ? 'trowel' : 'roller') as IconName,
                }))}
                hrefOf={(k) => href({ sc: k, e: 2 })}
              />
              <input type="hidden" name="sc" value={scope} />
              <p className="mt-2 text-xs leading-6 text-faint">{t.scopeNote}</p>
            </fieldset>

            <button type="submit" className="min-h-11 justify-self-start rounded border border-line px-5 text-sm font-semibold">
              {rooms ? t.redraw : t.recalc}
            </button>
          </form>

          {/* الرسم: توزيع مساحات لا مخطّط — ولمن له غرفٌ وحده */}
          {rooms && (
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
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={href({ e: 1 })} className="text-sm text-muted underline underline-offset-4">
              {t.back}
            </Link>
            {/* بلا غرفٍ لا رسم، والمرور لا يُحجب على رسمٍ لا يُنتظر */}
            {(!rooms || sketch?.fits) && (
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
      {step === 3 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q3}</h1>

          {/* صندوق الميزانية كما في الماكيتة F03: الرقم كبيرٌ لأنّه السؤال */}
          <form action={`/${locale}/projet`} className="mt-6">
            <input type="hidden" name="e" value="3" />
            {carry(['type', 's', 'l', 'ch', 'sa', 'cu', 'sdb', 'del', 'tr', 'sys', 'k', 'u', 'h', 'sp', 'sc', 'fin'])}
            <div className="rounded-xl border-2 border-line bg-surface p-4">
              <label className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
                    <Icon name="coins" className="h-5 w-5" />
                  </span>
                  {dict.budget.amount}
                </span>
                <input
                  name="b"
                  inputMode="numeric"
                  defaultValue={hasBudget ? String(budget) : ''}
                  placeholder={`30${THIN_NBSP}000`}
                  required
                  className="num min-w-0 flex-1 basis-40 rounded-lg border border-line bg-ground px-3 py-2.5 text-2xl font-semibold"
                />
                <span className="text-sm text-muted">{dict.budget.currency}</span>
              </label>
              <button
                type="submit"
                className="mt-3 min-h-11 w-full rounded-lg bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-deep sm:w-auto sm:px-8"
              >
                {dict.budget.submit}
              </button>
            </div>
          </form>

          {/* ── الكاتالوج: اختيار التشطيبات (اختياري) — الماكيتة F03 ── */}
          {(finishLots.data ?? []).length > 0 && (
            <section className="mt-6 rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name="layers" className="h-4 w-4 text-gold" />
                  {t.finishTitle}
                </h2>
                <Link
                  href={`/${locale}/catalogue`}
                  className="text-xs text-muted underline underline-offset-4 hover:text-brand"
                >
                  {t.finishCatalog} ←
                </Link>
              </div>
              <p className="mt-1 text-xs leading-6 text-faint">{t.finishNote}</p>

              <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(finishLots.data ?? []).map((l) => {
                  const code = String(l.code)
                  const on = finishes.includes(code)
                  const next = on ? finishes.filter((x) => x !== code) : [...finishes, code]
                  return (
                    <li key={code}>
                      <Link
                        href={href({ fin: next.join(',') || undefined, e: 3 })}
                        aria-current={on ? 'true' : undefined}
                        className={`relative flex h-full flex-col items-center rounded-lg border-2 p-2.5 text-center transition ${
                          on
                            ? 'border-brand bg-brand-soft'
                            : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        {on && (
                          <span
                            className="absolute top-1.5 grid size-4 place-items-center rounded-full bg-brand text-white"
                            style={{ insetInlineEnd: '0.375rem' }}
                          >
                            <Check className="h-2.5 w-2.5" width={4} />
                          </span>
                        )}
                        <span
                          className={`grid size-9 place-items-center rounded-lg ${
                            on ? 'bg-brand text-white' : 'bg-gold-soft text-gold'
                          }`}
                        >
                          <Icon name={FINISH_ICON[l.code] ?? 'layers'} className="h-4 w-4" />
                        </span>
                        <span className="mt-1.5 text-[11px] leading-4 font-medium">
                          {locale === 'fr' ? l.name_fr || l.name_ar : l.name_ar}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

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

          <form action={`/${locale}/projet`} className="mt-4">
            <input type="hidden" name="e" value="3" />
            {carry(['type', 's', 'l', 'ch', 'sa', 'cu', 'sdb', 'del', 'tr', 'b', 'sys', 'k', 'u', 'h', 'sp', 'sc', 'fin'])}
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
      {step === 4 && (
        <section className="mt-7">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.q4}</h1>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {rooms && sketch?.fits && (
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
              {rooms && (
              <div>
                <dt className="text-xs text-faint">{t.summaryRooms}</dt>
                <dd className="mt-0.5 font-medium">
                  <span className="num">{isolateNumbers(String(config.bedrooms))}</span>{' '}
                  {t.roomsShort} ·{' '}
                  <span className="num">{isolateNumbers(String(config.bathrooms))}</span>{' '}
                  {t.bathsShort}
                </dd>
              </div>
              )}
              {asksUnits(type) && sp.u && (
                <div>
                  <dt className="text-xs text-faint">
                    {type === 'immobilier' ? t.unitsFlats : t.unitsShops}
                  </dt>
                  <dd className="num mt-0.5 font-medium">{isolateNumbers(String(sp.u))}</dd>
                </div>
              )}
              {asksSpan(type) && (sp.h || sp.sp) && (
                <div>
                  <dt className="text-xs text-faint">
                    {t.height} · {t.span}
                  </dt>
                  <dd className="num mt-0.5 font-medium">
                    {isolateNumbers(String(sp.h ?? '—'))} · {isolateNumbers(String(sp.sp ?? '—'))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-faint">{t.scopeTitle}</dt>
                <dd className="mt-0.5 font-medium">{t.scopes[scope]}</dd>
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

          {/* ── ابعث: اسم ورقم، وخلاص (الماكيتة F03) ── */}
          <div className="mt-7 rounded-xl border-2 border-line bg-surface p-5 sm:p-6">
            <span className="flex items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name="send" className="h-5 w-5" />
              </span>
              <h2 className="display text-xl font-semibold">{t.sendTitle}</h2>
            </span>
            <div className="mt-5 max-w-sm">
              <ProjectSend
                locale={locale}
                t={dict.account}
                account={t}
                /*
                  الغرف تُبعث لمن سُئل عنها وحده: مشروعٌ بلا غرف يحمل
                  قيمها الافتراضية فيصل إلى المكتب «عمارة فيها غرفتان».
                  الحريف لم يكذب — الخانة كذبت عنه.
                */
                specs={{
                  type,
                  s: String(config.surface),
                  l: String(config.levels),
                  ...(rooms
                    ? {
                        ch: String(config.bedrooms),
                        sa: String(config.livingRooms),
                        cu: String(config.kitchens),
                        sdb: String(config.bathrooms),
                      }
                    : {}),
                  del: sp.del ?? '',
                  tr: sp.tr ?? '',
                  sys: sp.sys ?? '',
                  k: kind,
                  sc: scope,
                  fin: finishes.join(','),
                  u: sp.u ?? '',
                  h: sp.h ?? '',
                  sp: sp.sp ?? '',
                  b: hasBudget ? String(budget) : '',
                }}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={href({ e: 3 })} className="text-sm text-muted underline underline-offset-4">
              {t.back}
            </Link>
          </div>

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
