'use client'

import { useActionState } from 'react'
import { applyImportAction, previewImportAction } from '@/lib/actions/catalog-import'
import {
  IMPORT_COLUMNS,
  initialImportState,
  type ImportState,
  type Issue,
  type PlanRow,
} from '@/lib/catalog-import'

const ISSUE_AR: Record<string, string> = {
  required: 'خانة واجبة فارغة',
  bad_code: 'صيغة المرجع موش مقبولة',
  duplicate_in_file: 'المرجع متكرّر في الملفّ (سطر',
  unknown_lot: 'لوط ما يوجدش',
  bad_unit: 'وحدة قيس موش معروفة',
  bad_availability: 'قيمة توفّر موش معروفة',
  bad_number: 'رقم موش صحيح',
  bad_lead_time: 'أجل توريد موش صحيح (0 إلى 365)',
  missing_header: 'ترويسة ناقصة',
  unknown_column: 'عمود موش معروف',
}

const ERROR_AR: Record<string, string> = {
  forbidden: 'ما عندكش الصلاحية.',
  empty: 'اختار ملفّاً فيه أسطر.',
  too_big: 'الملفّ كبير برشا. الحدّ ميغا واحد.',
  not_applicable: 'الخطّة ما تنجّمش تتطبّق: صلّح الأخطاء وعاود المعاينة.',
  server: 'صار مشكل. عاود.',
}

function issueText(i: Issue): string {
  const base = ISSUE_AR[i.code] ?? i.code
  if (i.code === 'duplicate_in_file') return `${base} ${i.detail})`
  return i.detail ? `${base}: ${i.detail}` : base
}

/**
 * استيراد الكاتالوج: ملفّ ← معاينة ← تأكيد.
 *
 * ما من زرّ يكتب في القاعدة قبل أن تُعرض الخطّة. والمعاينة تعرض «من»
 * و«إلى» لكلّ خانة تتبدّل، لا عدد أسطر — رقمٌ وحده لا يُراجَع.
 */
export default function CatalogImport() {
  const [state, preview, previewing] = useActionState<ImportState, FormData>(
    previewImportAction,
    initialImportState
  )

  if (state.step === 'preview' && state.plan) {
    return <Preview state={state} />
  }

  return (
    <div className="grid gap-3">
      {state.step === 'done' && state.applied && (
        <p className="rounded border border-line bg-[#e4f1ea] px-3 py-2 text-sm leading-7 text-[#1d6b45]">
          تمّ: <span className="num">{state.applied.created}</span> مقال جديد و
          <span className="num">{state.applied.updated}</span> محيَّن. المقالات الجديدة{' '}
          <b>غير منشورة</b> — النشر من لوحة الكاتالوج.
        </p>
      )}

      <form action={preview} className="grid gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ملفّ CSV</span>
          <input type="file" name="file" accept=".csv,text/csv,text/plain" required className="block w-full text-sm" />
        </label>
        {state.error && (
          <p role="alert" className="text-sm font-medium text-[#a32a24]">
            {ERROR_AR[state.error] ?? ERROR_AR.server}
          </p>
        )}
        <button
          type="submit"
          disabled={previewing}
          className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {previewing ? 'نقرا…' : 'عاين قبل الاستيراد'}
        </button>
      </form>

      <details className="rounded border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">الأعمدة المقبولة</summary>
        <p className="num mt-2 break-all text-xs leading-7 text-muted" dir="ltr">
          {IMPORT_COLUMNS.join(' · ')}
        </p>
        <p className="mt-2 text-xs leading-7 text-muted">
          <b>code</b> و<b>lot_code</b> و<b>designation_ar</b> و<b>unit</b> واجبة للمقال الجديد.
          الخانة الفارغة معناها <b>«ما تبدّلش»</b> موش «امسح». الفاصل يتعرف وحدو (، ؛ أو tab).
        </p>
      </details>
    </div>
  )
}

function Preview({ state }: { state: ImportState }) {
  const [applied, apply, applying] = useActionState<ImportState, FormData>(
    applyImportAction,
    state
  )
  const plan = applied.plan ?? state.plan!
  const text = applied.text ?? state.text ?? ''

  if (applied.step === 'done' && applied.applied) {
    return (
      <p className="rounded border border-line bg-[#e4f1ea] px-3 py-2 text-sm leading-7 text-[#1d6b45]">
        تمّ: <span className="num">{applied.applied.created}</span> مقال جديد و
        <span className="num">{applied.applied.updated}</span> محيَّن. المقالات الجديدة{' '}
        <b>غير منشورة</b> — النشر من لوحة الكاتالوج.
      </p>
    )
  }

  const errors = plan.rows.filter((r) => r.action === 'error')
  const changes = plan.rows.filter((r) => r.action === 'create' || r.action === 'update')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge n={plan.counts.create} label="جديد" tone="ok" />
        <Badge n={plan.counts.update} label="تحيين" tone="info" />
        <Badge n={plan.counts.unchanged} label="بلا تغيير" tone="mute" />
        <Badge n={plan.counts.error} label="خطأ" tone="bad" />
      </div>

      {plan.unknownColumns.length > 0 && (
        <p className="rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
          أعمدة ما نعرفوهمش وباش نتجاهلوهم:{' '}
          <span className="num" dir="ltr">
            {plan.unknownColumns.join(' · ')}
          </span>
        </p>
      )}

      {errors.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[#a32a24]">تقرير الأخطاء</h3>
          <ul className="mt-2 grid gap-1.5">
            {errors.slice(0, 50).map((r) => (
              <li key={r.line} className="rounded border border-[#e0b4ac] bg-[#fbeeeb] px-3 py-2 text-sm">
                <span className="num">سطر {r.line}</span>
                {r.code ? <span className="num"> · {r.code}</span> : null} —{' '}
                {r.issues.map(issueText).join(' · ')}
              </li>
            ))}
          </ul>
          {errors.length > 50 && (
            <p className="mt-2 text-xs text-faint">
              وباقي <span className="num">{errors.length - 50}</span> سطر فيه خطأ.
            </p>
          )}
        </section>
      )}

      {changes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">شنوّة باش يتبدّل</h3>
          <ul className="mt-2 grid gap-1.5">
            {changes.slice(0, 80).map((r) => (
              <ChangeRow key={r.line} row={r} />
            ))}
          </ul>
          {changes.length > 80 && (
            <p className="mt-2 text-xs text-faint">
              وباقي <span className="num">{changes.length - 80}</span> سطر.
            </p>
          )}
        </section>
      )}

      {applied.error && (
        <p role="alert" className="text-sm font-medium text-[#a32a24]">
          {ERROR_AR[applied.error] ?? ERROR_AR.server}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={apply}>
          <input type="hidden" name="text" value={text} />
          <button
            type="submit"
            disabled={applying || plan.counts.error > 0 || plan.counts.create + plan.counts.update === 0}
            className="min-h-10 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {applying ? 'نطبّق…' : 'طبّق الاستيراد'}
          </button>
        </form>
        <a href="/admin/bordereau/import" className="min-h-10 rounded border border-line px-4 py-2 text-sm">
          ملفّ آخر
        </a>
      </div>

      {plan.counts.error > 0 && (
        <p className="text-xs leading-7 text-faint">
          خطأ واحد يمنع التطبيق كلّه: استيراد نصفو يخلّي القاعدة لا تطابق الملفّ ولا اللي قبلو.
        </p>
      )}
    </div>
  )
}

function ChangeRow({ row }: { row: PlanRow }) {
  return (
    <li className="rounded border border-line bg-surface px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-xs text-faint">سطر {row.line}</span>
        <span className="num font-semibold">{row.code}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            row.action === 'create' ? 'bg-[#e4f1ea] text-[#1d6b45]' : 'bg-brand-soft text-brand'
          }`}
        >
          {row.action === 'create' ? 'جديد' : 'تحيين'}
        </span>
      </div>
      {row.action === 'update' && (
        <ul className="mt-1.5 grid gap-0.5 text-xs">
          {row.changes.map((c) => (
            <li key={c.column} className="flex flex-wrap items-baseline gap-1.5">
              <span className="num text-faint" dir="ltr">
                {c.column}
              </span>
              <span className="num text-muted line-through">{c.from || '—'}</span>
              <span aria-hidden>←</span>
              <span className="num font-medium">{c.to}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Badge({ n, label, tone }: { n: number; label: string; tone: 'ok' | 'info' | 'mute' | 'bad' }) {
  const cls = {
    ok: 'bg-[#e4f1ea] text-[#1d6b45]',
    info: 'bg-brand-soft text-brand',
    mute: 'bg-surface-2 text-muted',
    bad: 'bg-[#fae9e8] text-[#a32a24]',
  }[tone]
  return (
    <span className={`rounded px-2.5 py-1 font-medium ${cls}`}>
      <span className="num">{n}</span> {label}
    </span>
  )
}
