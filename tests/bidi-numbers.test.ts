import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getDictionary } from '@/lib/i18n'
import { THIN_NBSP, formatMoney, formatNumber, formatRange, formatSignedMoney } from '@/lib/format'

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
        if (PLAIN_SPACE_BETWEEN_DIGITS.test(line)) {
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
