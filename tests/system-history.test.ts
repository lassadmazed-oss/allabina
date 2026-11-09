import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { historyToText, parseHistory } from '@/lib/construction'

/**
 * محطّات تاريخ طرق البناء.
 *
 * المحطّات تُكتب في اللوحة نصّاً وتُخزَّن jsonb، فبين الاثنين محوّلان.
 * خطأ في أحدهما لا يُسقط صفحة ولا يرفع استثناء: يمسح محطّة بصمت، أو
 * يرجّع للمحرّر نصّاً غير الذي كتبه فيفقد ثقته في الخانة ويتوقّف عن
 * استعمالها. لذلك نختبر الذهاب والرجوع معاً لا الذهاب وحده.
 */

describe('قراءة المحطّات من نصّ اللوحة', () => {
  it('سطر كامل يعطي محطّة بحقولها', () => {
    expect(parseHistory('1899 | قالب البلوك المجوّف | Moule du bloc creux | US 674,874')).toEqual([
      {
        year: '1899',
        ar: 'قالب البلوك المجوّف',
        fr: 'Moule du bloc creux',
        src: 'US 674,874',
        year_fr: null,
      },
    ])
  })

  it('الخانة الخامسة تترجم الحقبة وحدها', () => {
    // «اليوم» في صفحة فرنسية ليست سنة، وسنةٌ رقمها 1899 لا تحتاج ترجمة
    expect(parseHistory('اليوم | مسبق الإجهاد | Précontraint | — | Aujourd’hui')[0]).toMatchObject({
      year: 'اليوم',
      year_fr: 'Aujourd’hui',
    })
  })

  it('الفرنسية والمصدر اختياريان', () => {
    expect(parseHistory('النقلة | دخلت الخرسانة المسلّحة')).toEqual([
      { year: 'النقلة', ar: 'دخلت الخرسانة المسلّحة', fr: null, src: null, year_fr: null },
    ])
  })

  it('السطر الفارغ يُتجاهل ولا يصير محطّة بيضاء', () => {
    expect(parseHistory('\n\n1852 | بداية فرنسية\n   \n')).toHaveLength(1)
  })

  it('سطر بلا سنة أو بلا نصّ عربي يُرمى: نصف محطّة أسوأ من لا شيء', () => {
    expect(parseHistory('| نصّ بلا سنة\n1907 |   \n1907 | ألف صانع')).toEqual([
      { year: '1907', ar: 'ألف صانع', fr: null, src: null, year_fr: null },
    ])
  })

  it('«السنة» تقبل مجالاً وحقبة، لا أرقاماً وحدها', () => {
    const years = parseHistory('1855–1864 | كنيسة\nاليوم | مسبق الإجهاد').map((h) => h.year)
    expect(years).toEqual(['1855–1864', 'اليوم'])
  })
})

describe('الذهاب والرجوع', () => {
  const text = [
    '1852 | بداية فرنسية | Un début français | AFGC',
    '1889 | آلة البلوك المصمت | Machine à bloc plein | Palmer',
    'اليوم | مسبق الإجهاد',
  ].join('\n')

  it('نصّ → محطّات → نفس النصّ حرفاً بحرف', () => {
    expect(historyToText(parseHistory(text))).toBe(text)
  })

  it('المحرّر الذي يفتح النموذج يرى ما كتبه، لا نسخة بفواصل زائدة', () => {
    // محطّة بحقلين تُكتب بحقلين: «اليوم | مسبق الإجهاد |  | » يجعل الخانة
    // تبدو مكسورة فيتوقّف المحرّر عن استعمالها.
    expect(historyToText(parseHistory('اليوم | مسبق الإجهاد'))).toBe('اليوم | مسبق الإجهاد')
  })

  it('لا تاريخ = نصّ فارغ لا «undefined»', () => {
    expect(historyToText(null)).toBe('')
    expect(historyToText([])).toBe('')
  })
})

describe('بذر المحطّات في الترحيل', () => {
  const sql = readFileSync('supabase/migrations/0050_system_history.sql', 'utf8')

  it('يُرجع محتوى البلوك المطموس بـupdate لا بـinsert', () => {
    // 0031 فيه `on conflict (code) do nothing`: إعادة تشغيله لا تصلح صفّاً
    // موجوداً. لو صار الإصلاح insert لبقي الخلل في القاعدة إلى الأبد.
    expect(sql).toContain("where code = 'BLOC_PPE'")
    expect(sql).toMatch(/update construction_systems set\s+name_ar = 'البلوك الخرساني/)
  })

  it('ما فيه رقم مفصول بفراغ عادي — الأرقام تُعرض في فقرة عربية', () => {
    expect(sql).not.toMatch(/[0-9][  ][0-9]/)
  })

  it('كلّ محطّة سنتها نصّ: المجالات والحقبات تمرّ', () => {
    const years = [...sql.matchAll(/"year": "([^"]+)"/g)].map((m) => m[1])
    expect(years.length).toBeGreaterThan(8)
    expect(years).toContain('1852')
    expect(years).toContain('اليوم')
  })
})
