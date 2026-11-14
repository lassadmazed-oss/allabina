/**
 * استيراد الكاتالوج — التحليل والتدقيق والخطّة، بلا قاعدة بيانات.
 *
 * كرّاس الشروط V2، القسم 03: «يُسلّم جدول استيراد XLSX/CSV ومعاينة قبل
 * الاستيراد وتقرير أخطاء»، والقسم 07: «استيراد مع dry-run ومنع تكرار
 * المراجع. مقترح تغيير يبين القديم والجديد».
 *
 * القاعدة التي تحكم كلّ ما تحت: **لا يُكتب شيء قبل أن يُعرض ما سيُكتب.**
 * ملفّ من 333 سطراً يُطبَّق بلا معاينة يصلح الخمسين ويفسد الثلاثة،
 * ولا أحد يعرف أيّ ثلاثة.
 *
 * وقاعدة ثانية: **الخانة الفارغة تعني «لا تبدّل» لا «امسح».** جدول
 * جزئي فيه عمودان يُرسل لتصحيح اسمين، فيمسح الأسعار كلّها — هذا أسوأ
 * ما يمكن أن يفعله استيراد.
 */

export const IMPORT_COLUMNS = [
  'code',
  'lot_code',
  'designation_ar',
  'designation_fr',
  'unit',
  'qty_formula',
  'pu_fourniture_ht',
  'pu_main_oeuvre_ht',
  'availability',
  'lead_time_days',
  'description',
] as const
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

export const REQUIRED_COLUMNS: ImportColumn[] = ['code', 'lot_code', 'designation_ar', 'unit']
export const UNITS = ['m2', 'ml', 'm3', 'kg', 'u', 'forfait'] as const
export const AVAILABILITIES = ['in_stock', 'on_order', 'on_survey'] as const

export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,29}$/

// ───────────────────────────────────────────────────── التحليل

/**
 * الفاصل يُستنتج من سطر العنوان: Excel عربي وفرنسي يصدّر بـ«؛» لا بـ«,»
 * حسب إعدادات النظام، والمستعمل لا يعرف ذلك ولا يُفترض أن يعرفه.
 */
export function detectDelimiter(firstLine: string): ',' | ';' | '\t' {
  const counts: [string, number][] = [
    [',', (firstLine.match(/,/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return (counts[0][1] > 0 ? counts[0][0] : ',') as ',' | ';' | '\t'
}

/**
 * قارئ CSV: يحترم الاقتباس المزدوج و«""» داخله، ويقبل CRLF وLF،
 * ويشيل علامة BOM التي يضعها Excel في أوّل الملفّ — وبدون إزالتها
 * يصير اسم أوّل عمود «﻿code» فلا يُعرف.
 */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = (text ?? '').replace(/^﻿/, '')
  const d = delimiter ?? detectDelimiter(clean.split(/\r?\n/)[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') {
      quoted = true
    } else if (c === d) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

// ───────────────────────────────────────────────────── التدقيق

export type IssueCode =
  | 'missing_header'
  | 'unknown_column'
  | 'required'
  | 'bad_code'
  | 'duplicate_in_file'
  | 'unknown_lot'
  | 'bad_unit'
  | 'bad_availability'
  | 'bad_number'
  | 'bad_lead_time'

export type Issue = { column?: string; code: IssueCode; detail?: string }

export type ExistingArticle = {
  code: string
  lotCode: number
  designationAr: string
  designationFr: string | null
  unit: string
  qtyFormula: string | null
  puFournitureHt: number | null
  puMainOeuvreHt: number | null
  availability: string
  leadTimeDays: number | null
  description: string | null
}

export type Change = { column: ImportColumn; from: string; to: string }

export type PlanRow = {
  line: number
  code: string
  action: 'create' | 'update' | 'unchanged' | 'error'
  values: Partial<Record<ImportColumn, string>>
  changes: Change[]
  issues: Issue[]
}

export type Plan = {
  delimiter: string
  headers: string[]
  unknownColumns: string[]
  missingRequired: string[]
  rows: PlanRow[]
  counts: { create: number; update: number; unchanged: number; error: number }
}

const num = (v: string): number | null => {
  const t = v.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** القيمة الحالية كنصّ للمقارنة — null و«» شيء واحد في العرض */
const asText = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function buildPlan(
  text: string,
  existing: ExistingArticle[],
  knownLotCodes: number[]
): Plan {
  const table = parseCsv(text)
  const delimiter = detectDelimiter((text ?? '').replace(/^﻿/, '').split(/\r?\n/)[0] ?? '')

  if (!table.length) {
    return {
      delimiter,
      headers: [],
      unknownColumns: [],
      missingRequired: [...REQUIRED_COLUMNS],
      rows: [],
      counts: { create: 0, update: 0, unchanged: 0, error: 0 },
    }
  }

  const headers = table[0].map((h) => h.trim().toLowerCase())
  const unknownColumns = headers.filter((h) => h && !(IMPORT_COLUMNS as readonly string[]).includes(h))
  // الترويسة بلا «code» لا معنى لها أصلاً؛ وبقيّة الواجبات تُطلب عند
  // الإنشاء فقط، فغيابها يُحتسب بعد أن نعرف هل في الملفّ إنشاءٌ أم لا.
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))

  const byCode = new Map(existing.map((e) => [e.code.toUpperCase(), e]))
  const seen = new Map<string, number>()
  const rows: PlanRow[] = []

  for (let r = 1; r < table.length; r++) {
    const line = r + 1
    const cells = table[r]
    const values = {} as Partial<Record<ImportColumn, string>>
    headers.forEach((h, i) => {
      if ((IMPORT_COLUMNS as readonly string[]).includes(h)) {
        values[h as ImportColumn] = (cells[i] ?? '').trim()
      }
    })

    const issues: Issue[] = []
    const code = (values.code ?? '').trim().toUpperCase()
    const current = code ? byCode.get(code) : undefined

    // الواجب واجبٌ عند الإنشاء لا عند التحيين: جدول جزئي يُرسل لتصحيح
    // عمود واحد، وليس على صاحبه أن يعيد كتابة الاسم والوحدة معه.
    for (const c of REQUIRED_COLUMNS) {
      if (c !== 'code' && current) continue
      if (!headers.includes(c)) continue
      if (!(values[c] ?? '').trim()) issues.push({ column: c, code: 'required' })
    }
    if (code && !CODE_RE.test(code)) issues.push({ column: 'code', code: 'bad_code', detail: code })
    if (code) {
      const first = seen.get(code)
      if (first !== undefined) {
        issues.push({ column: 'code', code: 'duplicate_in_file', detail: String(first) })
      } else seen.set(code, line)
    }

    const lotRaw = values.lot_code
    if (lotRaw) {
      const lot = num(lotRaw)
      if (lot === null || !knownLotCodes.includes(lot)) {
        issues.push({ column: 'lot_code', code: 'unknown_lot', detail: lotRaw })
      }
    }
    if (values.unit && !(UNITS as readonly string[]).includes(values.unit)) {
      issues.push({ column: 'unit', code: 'bad_unit', detail: values.unit })
    }
    if (values.availability && !(AVAILABILITIES as readonly string[]).includes(values.availability)) {
      issues.push({ column: 'availability', code: 'bad_availability', detail: values.availability })
    }
    for (const c of ['pu_fourniture_ht', 'pu_main_oeuvre_ht'] as const) {
      const raw = values[c]
      if (!raw) continue
      const n = num(raw)
      if (n === null || n < 0) issues.push({ column: c, code: 'bad_number', detail: raw })
    }
    if (values.lead_time_days) {
      const n = num(values.lead_time_days)
      if (n === null || n < 0 || n > 365 || !Number.isInteger(n)) {
        issues.push({ column: 'lead_time_days', code: 'bad_lead_time', detail: values.lead_time_days })
      }
    }

    if (issues.length) {
      rows.push({ line, code, action: 'error', values, changes: [], issues })
      continue
    }

    if (!current) {
      rows.push({ line, code, action: 'create', values, changes: [], issues: [] })
      continue
    }

    // الخانة الفارغة = «لا تبدّل». جدول جزئي لا يمسح ما ليس فيه.
    const currentText: Record<ImportColumn, string> = {
      code: current.code,
      lot_code: asText(current.lotCode),
      designation_ar: asText(current.designationAr),
      designation_fr: asText(current.designationFr),
      unit: asText(current.unit),
      qty_formula: asText(current.qtyFormula),
      pu_fourniture_ht: asText(current.puFournitureHt),
      pu_main_oeuvre_ht: asText(current.puMainOeuvreHt),
      availability: asText(current.availability),
      lead_time_days: asText(current.leadTimeDays),
      description: asText(current.description),
    }

    const changes: Change[] = []
    for (const c of IMPORT_COLUMNS) {
      if (c === 'code') continue
      const to = values[c]
      if (to === undefined || to === '') continue
      const from = currentText[c]
      const same =
        c === 'pu_fourniture_ht' || c === 'pu_main_oeuvre_ht' || c === 'lot_code' || c === 'lead_time_days'
          ? num(to) === num(from)
          : to === from
      if (!same) changes.push({ column: c, from, to })
    }

    rows.push({
      line,
      code,
      action: changes.length ? 'update' : 'unchanged',
      values,
      changes,
      issues: [],
    })
  }

  const counts = { create: 0, update: 0, unchanged: 0, error: 0 }
  for (const r of rows) counts[r.action]++

  return { delimiter, headers, unknownColumns, missingRequired, rows, counts }
}

/**
 * هل يجوز التطبيق؟
 *
 * خطّة فيها خطأ واحد لا تُطبَّق نصفها: الاستيراد كلٌّ أو لا شيء، وإلّا
 * بقيت القاعدة في حالة لا تطابق الملفّ ولا ما قبله.
 *
 * والأعمدة الواجبة تمنع التطبيق إن كان في الخطّة إنشاء — لأنّ مقالاً
 * جديداً بلا لوط ولا وحدة لا معنى له. أمّا ملفّ تحيين جزئي (مرجع وسعر
 * مثلاً) فيمرّ: ليس على صاحبه أن يعيد كتابة الاسم والوحدة لتصحيح رقم.
 */
export const planApplicable = (plan: Plan): boolean => {
  if (plan.counts.error > 0) return false
  if (plan.counts.create > 0 && plan.missingRequired.length > 0) return false
  return plan.counts.create + plan.counts.update > 0
}

/** قالب للتحميل — بعلامة BOM حتّى يفتحه Excel بالعربية صحيحة */
export function templateCsv(): string {
  const sample = [
    'MA-01-B01',
    '5',
    'جدران خارجية آجرّ 20',
    'Murs extérieurs brique 20',
    'm2',
    'surface * 1.15',
    '28.500',
    '14.500',
    'on_order',
    '7',
    'آجرّ مجوّف 20 صم مع المونة',
  ]
  return '﻿' + [IMPORT_COLUMNS.join(','), sample.map((v) => `"${v}"`).join(',')].join('\r\n') + '\r\n'
}

// ─────────────────────────────────────────── حالة الشاشة

/**
 * تعيش هنا لا في ملفّ 'use server': ذاك لا يصدّر إلّا دوالّ غير
 * متزامنة، ومكوّن العميل يحتاج القيمة الابتدائية.
 */
export type ImportState = {
  step: 'idle' | 'preview' | 'done'
  plan?: Plan
  /** نصّ الملفّ — يعود مع التأكيد فيُعاد تحليله */
  text?: string
  applied?: { created: number; updated: number }
  error?: 'forbidden' | 'empty' | 'too_big' | 'not_applicable' | 'server'
}

export const initialImportState: ImportState = { step: 'idle' }

