import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getDictionary } from '@/lib/i18n'
import {
  THIN_NBSP,
  formatMoney,
  formatNumber,
  formatRange,
  formatSignedMoney,
  isolateNumbers,
} from '@/lib/format'

/**
 * الأرقام المقلوبة في العربية.
 *
 * خوارزمية الاتجاه ثنائي اللغة تعامل الفراغ العادي بين رقمين كمحرف
 * محايد، فتعطيه اتجاه الفقرة (يمين→يسار) فينقلب ترتيب الكتلتين:
 * «1 200» تُقرأ على الشاشة «200 1». المصيبة أنّ الرقم يبقى صحيحاً في
 * الكود وفي القاعدة — الخلل في العرض وحده، فلا يمسكه أيّ اختبار
 * يقارن قيماً.
 *
 * هذي الاختبارات تمسكه في المصدر: أيّ رقم مكتوب بفراغ عادي في نصّ
 * الواجهة يسقط البناء قبل أن يصل إلى شاشة أحد.
 */

/**
 * معطيات مسار SVG: نصّ يبدأ بأمر رسم ولا يحمل إلّا أوامر وأرقاماً.
 *
 * نميّزها بشكلها لا بموضعها، فتُستثنى أينما كُتبت — في سمة `d` أو في
 * جدول أيقونات. أوّل مرّة استثنينا الوسم وحده، فسقط الاختبار حين
 * انتقلت نفس المسارات إلى ثابت.
 */
// يبدأ بأيّ أمر رسم لا بـM وحدها: المسار الطويل يُقسَّم على أسطر، وسطره
// التالي يبدأ بـL أو C — نفس الإحداثيات، نفس الاستثناء.
const SVG_PATH_LITERAL = /["'`]\s*[MmLlHhVvCcSsQqTtAaZz][\d\s.,MmLlHhVvCcSsQqTtAaZz-]{12,}["'`]/

/** رقم + فراغ عادي (أو غير قابل للكسر) + رقم = قنبلة موقوتة */
const PLAIN_SPACE_BETWEEN_DIGITS = /[0-9][  ][0-9]/

function walkStrings(node: unknown, path: string, out: { path: string; value: string }[]) {
  if (typeof node === 'string') {
    out.push({ path, value: node })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out))
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walkStrings(v, path ? `${path}.${k}` : k, out)
  }
}

describe('نصوص الواجهة', () => {
  for (const name of ['ar', 'fr'] as const) {
    const dict = getDictionary(name)
    it(`«${name}» — ما فيها رقم مفصول بفراغ عادي`, () => {
      const all: { path: string; value: string }[] = []
      walkStrings(dict, '', all)
      const bad = all
        .filter((s) => PLAIN_SPACE_BETWEEN_DIGITS.test(s.value))
        .map((s) => `${s.path}: ${s.value.slice(0, 80)}`)

      // الرسالة تقول ماذا يُفعل، لا «فشل» فقط
      expect(
        bad,
        `استعمل U+202F (${THIN_NBSP.charCodeAt(0).toString(16)}) بين الأرقام بدل الفراغ العادي`
      ).toEqual([])
    })
  }
})

describe('المكوّنات والصفحات', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.next') walk(p)
      } else if (p.endsWith('.tsx')) {
        files.push(p)
      }
    }
  }
  walk('app')
  walk('components')

  it('ما فيها نصّ ظاهر برقم مفصول بفراغ عادي', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      src.split('\n').forEach((line, i) => {
        // مسارات SVG وviewBox أرقام تقنية لا تُقرأ، ونفس الشيء للتعليقات
        if (/viewBox|\bd="M|strokeWidth|<path|^\s*\*|^\s*\/\//.test(line)) return
        // ومسار SVG مخزّن في ثابت — نفس الأرقام، خارج الوسم
        if (SVG_PATH_LITERAL.test(line)) return
        // أصناف Tailwind (px-5 2xl:…) ليست نصّاً يُقرأ: تُفرَّغ قيمة className قبل الفحص
        const visible = line.replace(/className=(?:"[^"]*"|'[^']*'|{`[^`]*`})/g, 'className=""')
        if (PLAIN_SPACE_BETWEEN_DIGITS.test(visible)) {
          bad.push(`${f.replace(/\\/g, '/')}:${i + 1}  ${line.trim().slice(0, 90)}`)
        }
      })
    }
    expect(bad).toEqual([])
  })
})

describe('دوال التنسيق تعطي كتلة واحدة لا تنكسر', () => {
  it('formatNumber يفصل بـU+202F لا بفراغ', () => {
    expect(formatNumber(91733)).toBe(`91${THIN_NBSP}733`)
    expect(PLAIN_SPACE_BETWEEN_DIGITS.test(formatNumber(1200000))).toBe(false)
  })

  it('formatMoney كذلك', () => {
    expect(PLAIN_SPACE_BETWEEN_DIGITS.test(formatMoney(150000))).toBe(false)
  })

  it('formatSignedMoney يعزل الإشارة مع رقمها', () => {
    const out = formatSignedMoney(-12000)
    // ⁦ … ⁩ = LRI … PDI: الإشارة تبقى يسار الرقم مهما كان اتجاه الفقرة
    expect(out.startsWith('⁦−')).toBe(true)
    expect(out).toContain('⁩')
  })

  it('formatRange يعزل المجال: «من» تبقى يسار «إلى»', () => {
    const out = formatRange(1200, 2000)
    expect(out.startsWith('⁦')).toBe(true)
    expect(out.endsWith('⁩')).toBe(true)
    // الشرطة بين رقمين محايدة، والعزل هو ما يمنع «2 000 – 1 200»
    expect(out).toContain('–')
  })
})

describe('نصّ القاعدة: الكتلة بين رقمين', () => {
  /**
   * «50×20 صم» كانت تُعرض «20×50»، و«سقف 12+4» تُعرض «4+12».
   * قيسَت على الشاشة لا استُنتجت: المحرف بين رقمين محايد، فتعطيه
   * الخوارزمية اتجاه الفقرة ثمّ تقلب الكتلتين حوله. الرقم في القاعدة
   * صحيح، والخطأ في العين وحدها — وبلوك سماكته 20 صم يُقرأ 50 صم.
   */
  const isolated = (s: string) => `⁦${s}⁩`

  it('يعزل الضرب والجمع والمجال', () => {
    expect(isolateNumbers('بلوك 50×20 صم')).toBe(`بلوك ${isolated('50×20')} صم`)
    expect(isolateNumbers('سقف 12+4')).toBe(`سقف ${isolated('12+4')}`)
    expect(isolateNumbers('1975–2024')).toBe(isolated('1975–2024'))
  })

  it('يترك الرقم المجرّد والفاصلة العشرية: لا خطر فيهما', () => {
    expect(isolateNumbers('قرابة 1000 صانع')).toBe('قرابة 1000 صانع')
    expect(isolateNumbers('براءة 674,874 سنة 1901')).toBe('براءة 674,874 سنة 1901')
  })

  it('يترك علامة النسبة في جهتها العربية', () => {
    // فرض الاتّجاه اللاتيني ينقل ٪ إلى الجهة الأخرى بلا داعٍ
    expect(isolateNumbers('من 40,9٪ إلى 2,8٪')).toBe('من 40,9٪ إلى 2,8٪')
  })

  it('يعزل كلّ كتلة في الجملة لا الأولى وحدها', () => {
    expect(isolateNumbers('من 12+4 إلى 20+6')).toBe(
      `من ${isolated('12+4')} إلى ${isolated('20+6')}`
    )
  })

  it('لا يعزل مرّتين: نصّ مرّ على الدالّة مرّة يخرج منها كما دخل', () => {
    const once = isolateNumbers('بلوك 50×20 صم')
    expect(isolateNumbers(once)).toBe(once)
  })

  it('يمرّر الفارغ كما هو: حقل القاعدة قد يكون null', () => {
    expect(isolateNumbers(null)).toBe(null)
    expect(isolateNumbers(undefined)).toBe(undefined)
    expect(isolateNumbers('')).toBe('')
  })

  it('الكتلة المعزولة كتلة واحدة لا تنكسر', () => {
    const out = isolateNumbers('50×20')
    expect(out.startsWith('⁦')).toBe(true)
    expect(out.endsWith('⁩')).toBe(true)
  })
})
