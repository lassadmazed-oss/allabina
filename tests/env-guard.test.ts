import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PROD_PROJECT_REF,
  assertWritable,
  classify,
  parseEnvFile,
  pgTargets,
} from '../scripts/lib/env.mjs'

/**
 * حارس البيئة.
 *
 * إلى 14/11/2026 كانت قاعدة واحدة للتطوير والإنتاج: ما يُبذر محلّياً يظهر
 * على الموقع الحيّ في نفس اللحظة. الحارس يفصلهما، وهذه الاختبارات تحرس
 * الحارس — لأنّ خطأه لا يظهر في شاشة، بل في سطر مكتوب فوق معطى حريف.
 *
 * القاعدة المختبَرة: الإنتاج يُعرَف **بعنوانه** لا باسم ملفّه. ملفّ اسمه
 * .env يشير إلى مشروع الإنتاج يُعامَل معاملة الإنتاج.
 */
const prodUrl = `https://${PROD_PROJECT_REF}.supabase.co`
const env = (url: string) => ({ vars: { SUPABASE_URL: url }, ...classify(url) })

describe('تمييز البيئة بالعنوان', () => {
  it('عنوان مشروع الإنتاج يُعرَف إنتاجاً', () => {
    expect(classify(prodUrl).isProd).toBe(true)
    expect(classify(prodUrl).isLocal).toBe(false)
  })

  it('الحلقة المحلّية تُعرَف محلّية بكلّ أشكالها', () => {
    for (const u of ['http://127.0.0.1:54331', 'http://localhost:54331']) {
      expect(classify(u).isLocal, u).toBe(true)
      expect(classify(u).isProd, u).toBe(false)
    }
  })

  it('مشروع ثالث ليس إنتاجاً ولا محلّياً', () => {
    const k = classify('https://abcdefghijklmnop.supabase.co')
    expect(k.isProd).toBe(false)
    expect(k.isLocal).toBe(false)
  })

  it('عنوان فارغ أو مكسور لا يرمي ولا يُعدّ إنتاجاً', () => {
    expect(classify('').isProd).toBe(false)
    expect(classify('ليس عنواناً').isProd).toBe(false)
  })
})

describe('حارس الكتابة', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('المحلّي يُكتب فيه بلا إذن', () => {
    expect(() => assertWritable(env('http://127.0.0.1:54331'), 'بذر')).not.toThrow()
  })

  it('الإنتاج يرفض الكتابة، والرسالة تقول كيف يُتجاوز', () => {
    expect(() => assertWritable(env(prodUrl), 'تطبيق الهجرات')).toThrow(/ALLOW_PROD_WRITE/)
  })

  it('الإذن الصريح يمرّ — ومكانه المحيط لا ملفّ يُنسى مفتوحاً', () => {
    vi.stubEnv('ALLOW_PROD_WRITE', '1')
    expect(() => assertWritable(env(prodUrl), 'تطبيق الهجرات')).not.toThrow()
  })

  it('قيمة غير 1 لا تكفي — لا «true» ولا «yes»', () => {
    for (const v of ['true', 'yes', '0', '']) {
      vi.stubEnv('ALLOW_PROD_WRITE', v)
      expect(() => assertWritable(env(prodUrl)), v).toThrow()
    }
  })
})

describe('معاملات الاتّصال', () => {
  it('المحلّي: منفذ الحزمة، بلا SSL، مضيف واحد', () => {
    const t = pgTargets(env('http://127.0.0.1:54331'))
    expect(t).toHaveLength(1)
    expect(t[0].host).toBe('127.0.0.1')
    expect('ssl' in t[0], 'لا SSL على الحلقة المحلّية').toBe(false)
    expect(t[0].user).toBe('postgres')
  })

  it('الإنتاج: pooler ثمّ المباشر، وكلّهم بـSSL', () => {
    const t = pgTargets({ vars: { SUPABASE_URL: prodUrl, DATABASE_PASSWORD: 'x' }, ...classify(prodUrl) })
    expect(t.length).toBeGreaterThan(1)
    for (const x of t) expect('ssl' in x, x.host).toBe(true)
    expect(t[0].user).toBe(`postgres.${PROD_PROJECT_REF}`)
  })
})

describe('قراءة ملفّ البيئة', () => {
  it('يتخطّى التعليقات والفراغ، ويحافظ على علامات = داخل القيمة', () => {
    const v = parseEnvFile(['# تعليق', '', 'A=1', 'B = two ', 'C=a=b=c'].join('\n'))
    expect(v).toEqual({ A: '1', B: 'two', C: 'a=b=c' })
  })
})
