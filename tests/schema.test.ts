import { describe, expect, it } from 'vitest'
import { requestSchema } from '@/lib/schema'

/** ما يصل فعلاً من الاستمارة: الخطوات المخفيّة لا ترسل حقولها إطلاقاً */
const apartmentForm = {
  requestType: 'apartment',
  govCode: 'SFX',
  delegationId: '3',
  desiredAreaM2: '80',
  bedrooms: '',
  horizon: 'now',
  monthlyIncome: '2500',
  spouseIncome: '',
  otherIncome: '',
  existingLoans: '150',
  downPayment: '40000',
  maxMonthly: '',
  employment: 'private',
  seniorityYears: '3',
  fullName: 'أمينة الشابي',
  phone: '25444333',
  email: '',
  hasWater: false,
  hasPower: false,
  hasRoad: false,
  hasPermit: false,
  isExpat: false,
  consent: true,
}

const errorPaths = (r: ReturnType<typeof requestSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => String(i.path[0]))

describe('استمارة بلا خطوة الأرض', () => {
  it('تنجح رغم غياب حقول الأرض كلّها (الخلل الذي عطّل الإرسال)', () => {
    const r = requestSchema.safeParse(apartmentForm)
    expect(errorPaths(r)).toEqual([])
    expect(r.success).toBe(true)
  })

  it('الحقول الفارغة تصير null والأرقام الاختيارية صفراً', () => {
    const r = requestSchema.parse(apartmentForm)
    expect(r.bedrooms).toBeNull()
    expect(r.landAreaM2).toBeNull()
    expect(r.titleStatus).toBeNull()
    expect(r.standing).toBeNull()
    expect(r.spouseIncome).toBe(0)
    expect(r.delegationId).toBe(3)
    expect(r.desiredAreaM2).toBe(80)
  })
})

describe('مسار البناء', () => {
  it('يقبل حقول الأرض ومستوى التشطيب', () => {
    const r = requestSchema.parse({
      ...apartmentForm,
      requestType: 'build_on_land',
      standing: 'B03',
      landAreaM2: '300',
      titleStatus: 'titled',
      hasWater: true,
      hasPower: 'on',
      imadaId: '12',
      landLocation: 'حيّ النور',
    })
    expect(r.standing).toBe('B03')
    expect(r.landAreaM2).toBe(300)
    expect(r.hasWater).toBe(true)
    expect(r.hasPower).toBe(true)
    expect(r.hasRoad).toBe(false)
    expect(r.imadaId).toBe(12)
    expect(r.landLocation).toBe('حيّ النور')
  })
})

describe('التحقّق يرفض ما يجب رفضه', () => {
  it('بلا موافقة على معالجة المعطيات', () => {
    expect(errorPaths(requestSchema.safeParse({ ...apartmentForm, consent: false }))).toContain(
      'consent'
    )
  })

  it('رقم هاتف غير صحيح', () => {
    expect(errorPaths(requestSchema.safeParse({ ...apartmentForm, phone: '123' }))).toContain(
      'phone'
    )
  })

  it('نوع نشاط خارج القائمة', () => {
    expect(errorPaths(requestSchema.safeParse({ ...apartmentForm, employment: 'ceo' }))).toContain(
      'employment'
    )
  })

  it('اسم أقصر من ثلاثة أحرف', () => {
    expect(errorPaths(requestSchema.safeParse({ ...apartmentForm, fullName: 'أب' }))).toContain(
      'fullName'
    )
  })

  it('مساحة خارج المجال المسموح', () => {
    expect(
      errorPaths(requestSchema.safeParse({ ...apartmentForm, desiredAreaM2: '900' }))
    ).toContain('desiredAreaM2')
  })

  it('بريد إلكتروني غير صحيح', () => {
    expect(errorPaths(requestSchema.safeParse({ ...apartmentForm, email: 'ali@' }))).toContain(
      'email'
    )
  })
})

describe('تنظيف المدخلات', () => {
  it('يحذف الفراغات والشرطات من رقم الهاتف', () => {
    expect(requestSchema.parse({ ...apartmentForm, phone: ' 25 444-333 ' }).phone).toBe('25444333')
  })

  it('يقبل المفتاح الدولي للتونسيين بالخارج', () => {
    const r = requestSchema.parse({
      ...apartmentForm,
      phone: '+33 6 12 34 56 78',
      isExpat: 'on',
      expatCountry: 'France',
    })
    expect(r.phone).toBe('+33612345678')
    expect(r.isExpat).toBe(true)
    expect(r.expatCountry).toBe('France')
  })

  it('يزيل الفراغات من طرفي الاسم', () => {
    expect(requestSchema.parse({ ...apartmentForm, fullName: '  سامي بن عمار  ' }).fullName).toBe(
      'سامي بن عمار'
    )
  })
})

describe('الحقول متعدّدة القيم', () => {
  /**
   * FormData.entries() تعطي مدخلاً لكلّ خانة مؤشّرة، وObject.fromEntries
   * تحتفظ بالأخير. الاختبار يثبّت أنّ المخطّط يقبل المصفوفة كما تصل من
   * getAll، وأنّ القيمة الواحدة تبقى مقبولة.
   */
  it('تقبل مصفوفة كاملة لا آخر قيمة', () => {
    const r = requestSchema.safeParse({ ...apartmentForm, flexibility: ['area', 'zone', 'timing'] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.flexibility).toEqual(['area', 'zone', 'timing'])
  })

  it('تقبل قيمة واحدة كنصّ', () => {
    const r = requestSchema.safeParse({ ...apartmentForm, flexibility: 'zone' })
    expect(r.success && r.data.flexibility).toEqual(['zone'])
  })

  it('تهمل ما ليس في القائمة بدل ما ترفض الاستمارة كلّها', () => {
    const r = requestSchema.safeParse({ ...apartmentForm, flexibility: ['area', 'hacked'] })
    expect(r.success && r.data.flexibility).toEqual(['area'])
  })

  it('الوثائق نفس القاعدة', () => {
    const r = requestSchema.safeParse({ ...apartmentForm, documents: ['id-card', 'land-title', 'xx'] })
    expect(r.success && r.data.documents).toEqual(['id-card', 'land-title'])
  })
})
