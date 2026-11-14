import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPlan,
  detectDelimiter,
  parseCsv,
  planApplicable,
  templateCsv,
  type ExistingArticle,
} from '@/lib/catalog-import'

/**
 * استيراد الكاتالوج.
 *
 * قاعدتان تحكمان كلّ ما تحت، وكلتاهما تُختبر هنا لأنّ خرقهما يتلف
 * بيانات حقيقية بلا رسالة خطأ:
 *
 *   1. لا يُكتب شيء قبل أن يُعرض ما سيُكتب. ملفّ 333 سطراً يُطبَّق بلا
 *      معاينة يصلح الخمسين ويفسد الثلاثة، ولا أحد يعرف أيّ ثلاثة.
 *   2. الخانة الفارغة تعني «لا تبدّل» لا «امسح». جدول جزئي يُرسل
 *      لتصحيح اسمين فيمسح الأسعار كلّها — أسوأ ما يفعله استيراد.
 */
const LOTS = [1, 5, 9]

const existing: ExistingArticle[] = [
  {
    code: 'MA-01-B01',
    lotCode: 5,
    designationAr: 'جدران آجرّ 20',
    designationFr: 'Murs brique 20',
    unit: 'm2',
    qtyFormula: 'surface * 1.15',
    puFournitureHt: 28.5,
    puMainOeuvreHt: 14.5,
    availability: 'on_order',
    leadTimeDays: 7,
    description: null,
  },
]

const HEAD = 'code,lot_code,designation_ar,unit,pu_fourniture_ht'

describe('قراءة الملفّ', () => {
  it('الفاصل يُستنتج — Excel عربي وفرنسي يصدّر بـ«؛»', () => {
    expect(detectDelimiter('code,lot_code,unit')).toBe(',')
    expect(detectDelimiter('code;lot_code;unit')).toBe(';')
    expect(detectDelimiter('code\tlot_code\tunit')).toBe('\t')
  })

  it('علامة BOM تُشال — بدونها اسم أوّل عمود لا يُعرف', () => {
    const t = parseCsv('﻿code,unit\nA-01,m2')
    expect(t[0][0]).toBe('code')
  })

  it('الاقتباس يحمي الفاصلة داخل النصّ', () => {
    const t = parseCsv('code,designation_ar\nA-01,"آجرّ 20، مجوّف"')
    expect(t[1][1]).toBe('آجرّ 20، مجوّف')
  })

  it('الاقتباس المزدوج داخل المقتبس', () => {
    expect(parseCsv('a\n"قال ""نعم"""')[1][0]).toBe('قال "نعم"')
  })

  it('CRLF وLF سواء، والأسطر الفارغة تُتخطّى', () => {
    const t = parseCsv('a,b\r\n1,2\r\n\r\n3,4\n')
    expect(t).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })
})

describe('التدقيق قبل الكتابة', () => {
  it('الأعمدة الواجبة الغائبة تُسمّى', () => {
    const plan = buildPlan('code,unit\nA-01,m2', existing, LOTS)
    expect(plan.missingRequired).toContain('lot_code')
    expect(plan.missingRequired).toContain('designation_ar')
    expect(planApplicable(plan)).toBe(false)
  })

  it('عمود غريب يُبلَّغ ولا يُسقط الملفّ', () => {
    const plan = buildPlan(`${HEAD},marge\nA-01,5,اسم,m2,10,30`, existing, LOTS)
    expect(plan.unknownColumns).toEqual(['marge'])
    expect(plan.counts.error).toBe(0)
  })

  it('مرجع مكرّر في نفس الملفّ: السطر الثاني خطأ ويُشار إلى الأوّل', () => {
    const plan = buildPlan(`${HEAD}\nA-01,5,اسم,m2,10\nA-01,5,اسم,m2,12`, existing, LOTS)
    expect(plan.rows[0].action).toBe('create')
    expect(plan.rows[1].action).toBe('error')
    expect(plan.rows[1].issues[0]).toMatchObject({ code: 'duplicate_in_file', detail: '2' })
  })

  it('لوط غير موجود، ووحدة غير معروفة، ورقم مكسور — كلّها بأسبابها', () => {
    const plan = buildPlan(
      `${HEAD}\nA-01,77,اسم,m2,10\nA-02,5,اسم,قطعة,10\nA-03,5,اسم,m2,abc`,
      existing,
      LOTS
    )
    expect(plan.rows.map((r) => r.issues[0]?.code)).toEqual([
      'unknown_lot',
      'bad_unit',
      'bad_number',
    ])
  })

  it('مرجع بصيغة غير مقبولة يُرفض', () => {
    const plan = buildPlan(`${HEAD}\nab,5,اسم,m2,10`, existing, LOTS)
    expect(plan.rows[0].issues[0].code).toBe('bad_code')
  })

  it('خطأ واحد يمنع التطبيق — لا يُطبَّق نصف ملفّ', () => {
    const plan = buildPlan(`${HEAD}\nA-01,5,اسم,m2,10\nA-02,77,اسم,m2,10`, existing, LOTS)
    expect(plan.counts.create).toBe(1)
    expect(plan.counts.error).toBe(1)
    expect(planApplicable(plan)).toBe(false)
  })
})

describe('الخطّة: ما سيُكتب بالضبط', () => {
  it('مرجع جديد = إنشاء', () => {
    const plan = buildPlan(`${HEAD}\nA-99,5,مقال جديد,m2,10`, existing, LOTS)
    expect(plan.rows[0].action).toBe('create')
    expect(plan.counts).toMatchObject({ create: 1, update: 0, error: 0 })
  })

  it('مرجع موجود بقيمة مختلفة = تحيين، مع «من» و«إلى»', () => {
    const plan = buildPlan(`code,pu_fourniture_ht\nMA-01-B01,31.000`, existing, LOTS)
    expect(plan.rows[0].action).toBe('update')
    expect(plan.rows[0].changes).toEqual([
      { column: 'pu_fourniture_ht', from: '28.5', to: '31.000' },
    ])
  })

  it('نفس القيمة بصيغة أخرى ليست تغييراً: 28.5 و«28.500» سواء', () => {
    const plan = buildPlan(`code,pu_fourniture_ht\nMA-01-B01,28.500`, existing, LOTS)
    expect(plan.rows[0].action).toBe('unchanged')
    expect(plan.counts.unchanged).toBe(1)
  })

  it('الفاصلة العشرية الفرنسية تُفهم: «28,5» ليست تغييراً', () => {
    const plan = buildPlan(`code,pu_fourniture_ht\nMA-01-B01,"28,5"`, existing, LOTS)
    expect(plan.rows[0].action).toBe('unchanged')
  })
})

describe('الخانة الفارغة لا تمسح', () => {
  it('جدول فيه الاسم وحده لا يلمس السعر', () => {
    const plan = buildPlan(`code,designation_ar,pu_fourniture_ht\nMA-01-B01,اسم جديد,`, existing, LOTS)
    expect(plan.rows[0].action).toBe('update')
    expect(plan.rows[0].changes.map((c) => c.column)).toEqual(['designation_ar'])
  })

  it('عمود غائب أصلاً لا يظهر في التغييرات', () => {
    const plan = buildPlan(`code,designation_ar\nMA-01-B01,اسم جديد`, existing, LOTS)
    expect(plan.rows[0].changes).toHaveLength(1)
  })

  it('ملفّ كلّه فراغات على مرجع موجود: لا تغيير ولا تطبيق', () => {
    const plan = buildPlan(`code,designation_ar,pu_fourniture_ht\nMA-01-B01,,`, existing, LOTS)
    expect(plan.rows[0].action).toBe('unchanged')
    expect(planApplicable(plan)).toBe(false)
  })
})

describe('القالب', () => {
  it('يحمل كلّ الأعمدة وعلامة BOM ليفتحه Excel بالعربية', () => {
    const t = templateCsv()
    expect(t.startsWith('﻿')).toBe(true)
    expect(t).toContain('code,lot_code,designation_ar')
  })

  it('سطره النموذجي يمرّ التدقيق — قالب يُرفض عند استعماله مزحة', () => {
    const plan = buildPlan(templateCsv(), existing, LOTS)
    expect(plan.missingRequired).toEqual([])
    expect(plan.counts.error).toBe(0)
  })
})

describe('التحيين الجزئي يمرّ', () => {
  it('ملفّ بمرجع وسعر فقط يُطبَّق — بلا إعادة كتابة الاسم والوحدة', () => {
    const plan = buildPlan(`code,pu_fourniture_ht\nMA-01-B01,31.000`, existing, LOTS)
    expect(plan.missingRequired.length).toBeGreaterThan(0)
    expect(plan.counts.create).toBe(0)
    expect(planApplicable(plan)).toBe(true)
  })

  it('لكن إنشاء مقال بلا لوط ولا وحدة لا يمرّ', () => {
    const plan = buildPlan(`code,pu_fourniture_ht\nA-99,31.000`, existing, LOTS)
    expect(plan.counts.create).toBe(1)
    expect(planApplicable(plan)).toBe(false)
  })
})

describe('سجلّ الفريق يقبل ما تكتبه الشفرة', () => {
  it('كلّ event_type مستعمل في الشفرة مسموح في القيد', () => {
    const used = new Set<string>()
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p)
          continue
        }
        if (!/\.(ts|tsx|mjs)$/.test(e.name)) continue
        const src = readFileSync(p, 'utf8')
        // الأنواع المكتوبة في سطر insert على staff_events وحده
        if (!src.includes("from('staff_events')")) continue
        for (const m of src.matchAll(/event_type: '([a-z._]+)'/g)) used.add(m[1])
      }
    }
    walk('lib')

    const sql = readFileSync('supabase/migrations/0059_staff_event_settings.sql', 'utf8')
    const missing = [...used].filter((t) => !sql.includes(`'${t}'`))
    expect(missing, 'نوع حدث تكتبه الشفرة ولا يقبله القيد = سطر يضيع بصمت').toEqual([])
  })
})
