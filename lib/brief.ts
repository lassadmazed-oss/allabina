/**
 * حوصلة الملفّ وحلول مقترحة — دوال صافية بلا أثر جانبي.
 *
 * الفريق كان يقرأ عشرين بطاقة قبل أن يقرّر. هنا نجمع ما يهمّ القرار في
 * فقرة، ونولّد من الأرقام نفسها مسارات ممكنة: تقليص المساحة، البناء على
 * مراحل، رفع التسبقة، المسار المدعّم، تسوية الأرض والرخص، تحضير ملفّ القرض.
 * كلّ حلّ يقول علاش ويعطي رقمه. القرار يبقى للفريق، والتمويل للبنك.
 */
import { computeCapacity, monthlyPayment, type Capacity, type FinanceSettings } from './finance'
import { formatMoney } from './format'

export type BriefLot = { code: number; name: string; total: number }

export type BriefInput = {
  requestType: string
  fullName: string
  bedrooms: number | null
  desiredAreaM2: number | null
  horizon: string | null
  urgency: string | null
  standingName: string | null
  delegation: string | null
  landLocation: string | null
  financingState: string | null
  cashReady: boolean
  /** area · zone · standing · timing · type · budget */
  flexibility: string[]
  isFirstHome: boolean | null
  foprolosInterest: boolean
  cnssAffiliated: boolean | null
  cnssYears: number | null
  householdSize: number | null
  dependents: number | null
  isRenting: boolean
  rentTnd: number | null
  fin: {
    monthlyIncome: number
    spouseIncome: number
    otherIncome: number
    existingLoans: number
    downPayment: number
    employment: string
    seniorityMonths: number
    isExpat: boolean
  } | null
  land: {
    areaM2: number | null
    titleStatus: string | null
    hasWater: boolean
    hasPower: boolean
    hasRoad: boolean
    hasPermit: boolean
    hasPlans: boolean | null
  } | null
  score: {
    total: number
    band: string
    maxLoan: number
    maxBudget: number
  } | null
  devis: { total: number; surface: number; version: number; lots: BriefLot[] } | null
  /** أسماء الوثائق الضرورية الناقصة */
  docsMissing: string[]
  openInquiries: number
  matchesCount: number
  ageDays: number
  settings?: FinanceSettings
}

export type Solution = {
  key: string
  title: string
  why: string
  steps: string[]
  /** الرقم الذي يحسم: مبلغ، مساحة، قسط */
  figure?: string
  /** go: يمشي الآن · fix: يحتاج تعديلاً أو قراراً · wait: مرهون بغير الفريق */
  tone: 'go' | 'fix' | 'wait'
}

export type Brief = {
  headline: string
  summary: string[]
  strengths: string[]
  gaps: string[]
  solutions: Solution[]
  nextStep: string
}

const EMPLOYMENT_AR: Record<string, string> = {
  public: 'وظيفة عمومية',
  private: 'قطاع خاصّ',
  expat: 'مقيم بالخارج',
  retired: 'متقاعد',
  self_employed: 'مهنة حرّة',
  other: 'نشاط آخر',
}

const HORIZON_AR: Record<string, string> = {
  now: 'فوراً',
  '6m': 'في حدود 6 أشهر',
  '12m': 'في حدود سنة',
  '24m': 'في حدود سنتين',
}

const TITLE_AR: Record<string, string> = {
  titled: 'رسم عقاري',
  in_progress: 'رسم في طور التسجيل',
  undivided: 'على الشياع',
  other: 'وضعية عقارية أخرى',
}

const TYPE_AR: Record<string, string> = {
  build_on_land: 'بناء على أرض مملوكة',
  land_and_house: 'أرض ودار',
  apartment: 'شقّة',
  rent_to_own: 'كراء مملّك',
  renovation: 'ترميم أو توسعة',
  economic: 'سكن اقتصادي',
  other: 'مشكل سكني آخر',
}

const tnd = (v: number) => `${formatMoney(Math.round(v), 'ar')}`
const years = (months: number) => {
  const y = Math.floor(months / 12)
  if (y <= 0) return 'أقلّ من سنة'
  if (y === 1) return 'سنة'
  if (y === 2) return 'سنتان'
  if (y <= 10) return `${y} سنوات`
  return `${y} سنة`
}

/** المرحلة الأولى من البناء: من الدراسات إلى الكهرباء (الحصص 1–9)؛ التشطيب بعدها */
export function splitPhases(lots: BriefLot[]): { shell: number; finishing: number } {
  let shell = 0
  let finishing = 0
  for (const l of lots) {
    if (l.code <= 9) shell += l.total
    else finishing += l.total
  }
  return { shell, finishing }
}

export type BriefFacts = {
  cap: Capacity | null
  budget: number
  loan: number
  down: number
  /** العرض − الميزانية؛ موجب = تجاوز. صفر بلا عرض */
  gap: number
  /** المساحة التي يدخل بها العرض في الميزانية بنفس كلفة المتر — عند التجاوز فقط */
  fitArea: number | null
  flex: Set<string>
}

/** الأرقام التي تُبنى عليها الحوصلة ومقترحات الحريف معاً — مصدر واحد حتى لا يختلفا */
export function briefFacts(i: BriefInput): BriefFacts {
  const cap = i.fin
    ? computeCapacity({
        monthlyIncome: i.fin.monthlyIncome,
        spouseIncome: i.fin.spouseIncome,
        otherIncome: i.fin.otherIncome,
        existingLoans: i.fin.existingLoans,
        downPayment: i.fin.downPayment,
        settings: i.settings,
      })
    : null
  const budget = i.score?.maxBudget || cap?.maxBudget || 0
  const loan = i.score?.maxLoan || cap?.maxLoan || 0
  const down = i.fin?.downPayment ?? 0
  const gap = i.devis ? i.devis.total - budget : 0
  const fitArea =
    i.devis && budget > 0 && gap > 0 && i.devis.surface > 0
      ? Math.floor((i.devis.surface * budget) / i.devis.total)
      : null
  return { cap, budget, loan, down, gap, fitArea, flex: new Set(i.flexibility) }
}

export function buildBrief(i: BriefInput): Brief {
  const summary: string[] = []
  const strengths: string[] = []
  const gaps: string[] = []
  const solutions: Solution[] = []

  const isBuild = i.requestType === 'build_on_land'
  const seeksProperty = i.requestType === 'land_and_house' || i.requestType === 'apartment' || i.requestType === 'economic'

  // ---------- من هو ----------
  const who: string[] = []
  if (i.fin) {
    who.push(EMPLOYMENT_AR[i.fin.employment] ?? i.fin.employment)
    if (i.fin.seniorityMonths > 0) who.push(`أقدمية ${years(i.fin.seniorityMonths)}`)
  }
  if (i.householdSize) who.push(`عائلة من ${i.householdSize}${i.dependents ? ` (${i.dependents} مُعالون)` : ''}`)
  if (i.isRenting) who.push(i.rentTnd ? `كاري بـ${tnd(i.rentTnd)}/شهر` : 'كاري')
  if (who.length) summary.push(who.join(' · '))

  // ---------- ماذا يريد ----------
  const want: string[] = [TYPE_AR[i.requestType] ?? i.requestType]
  if (i.desiredAreaM2) want.push(`${i.desiredAreaM2} م²`)
  if (i.bedrooms) want.push(`${i.bedrooms} غرف`)
  if (i.standingName) want.push(`تشطيب ${i.standingName}`)
  if (i.delegation) want.push(i.delegation.trim() + (i.landLocation?.trim() ? ` (${i.landLocation.trim()})` : ''))
  if (i.horizon) want.push(HORIZON_AR[i.horizon] ?? i.horizon)
  if (i.urgency === 'urgent') want.push('مستعجل')
  summary.push(want.join(' · '))

  // ---------- المال ----------
  const { cap, budget, loan, down, gap, fitArea, flex } = briefFacts(i)

  if (i.fin && cap) {
    const money = [`دخل الأسرة ${tnd(cap.income)}/شهر`]
    if (i.fin.existingLoans > 0) money.push(`أقساط جارية ${tnd(i.fin.existingLoans)}`)
    money.push(`تسبقة ${tnd(down)}`)
    money.push(`قسط متاح ${tnd(cap.maxPayment)}/شهر`)
    summary.push(money.join(' · '))
    if (i.cashReady) summary.push('فلوسه حاضرة — مسار بلا بنك')
    else summary.push(`قرض تقديري ${tnd(loan)} على ${cap.years} سنة → ميزانية ${tnd(budget)}`)
    if (cap.maxPayment <= 0) gaps.push('الأقساط الجارية تستهلك كامل القدرة على الاستدانة')
    if (budget > 0 && down / budget >= 0.25) strengths.push(`تسبقة قويّة (${Math.round((down / budget) * 100)}% من الميزانية)`)
    else if (down <= 0) gaps.push('بلا تسبقة مصرّح بها')
    if (i.fin.employment === 'public' && i.fin.seniorityMonths >= 24) strengths.push('دخل مستقرّ يقبله البنك بسهولة')
  } else {
    gaps.push('الملفّ المالي غير معبّأ')
  }

  // ---------- الأرض ----------
  if (isBuild) {
    if (i.land) {
      const l: string[] = []
      if (i.land.areaM2) l.push(`أرض ${i.land.areaM2} م²`)
      l.push(TITLE_AR[i.land.titleStatus ?? ''] ?? 'وضعية عقارية غير مصرَّح بها')
      const utils = [i.land.hasWater ? 'ماء' : null, i.land.hasPower ? 'كهرباء' : null, i.land.hasRoad ? 'طريق' : null].filter(Boolean)
      if (utils.length) l.push(utils.join('/'))
      l.push(i.land.hasPermit ? 'رخصة بناء موجودة' : 'بلا رخصة بناء')
      if (i.land.hasPlans === false) l.push('بلا أمثلة هندسية')
      summary.push(l.join(' · '))
      if (i.land.titleStatus === 'titled') strengths.push('الأرض برسم عقاري — ضمان مقبول للتمويل')
      if (i.land.hasWater && i.land.hasPower && i.land.hasRoad) strengths.push('الأرض مجهّزة: ماء وكهرباء ومنفذ')
    } else {
      gaps.push('معطيات الأرض غير معبّأة')
    }
  }

  // ---------- العرض ----------
  if (i.devis) {
    summary.push(
      `آخر عرض تقديري (نسخة ${i.devis.version}): ${tnd(i.devis.total)} على ${i.devis.surface} م²` +
        (budget > 0 ? (gap > 0 ? ` — يتجاوز الميزانية بـ${tnd(gap)}` : ` — داخل الميزانية بهامش ${tnd(-gap)}`) : '')
    )
  }

  // ---------- الوثائق والاستفسارات ----------
  if (i.docsMissing.length) {
    gaps.push(`ينقص من الضروري: ${i.docsMissing.join('، ')}`)
  } else if (i.fin) {
    strengths.push('كلّ الوثائق الضرورية مصرَّح بها')
  }
  if (i.openInquiries > 0) gaps.push(`${i.openInquiries} استفسار مفتوح بلا جواب`)
  if (i.ageDays >= 2 && i.financingState === 'not_started') gaps.push(`مرّ ${i.ageDays} يوم على التسجيل والتمويل ما بداش`)

  // ================= الحلول =================

  if (i.devis && budget > 0 && gap > 0) {
    // 1) تقليص المساحة حتى يدخل العرض في الميزانية
    if (fitArea !== null) {
      solutions.push({
        key: 'shrink',
        title: 'تقليص المساحة المبنيّة',
        why: `العرض ${tnd(i.devis.total)} والميزانية ${tnd(budget)}: الفجوة ${tnd(gap)}. بنفس التشطيب والكلفة للمتر، تدخل الدار في الميزانية عند ${fitArea} م².`,
        steps: [
          `اقتراح ${fitArea} م² بدل ${i.devis.surface} م² (${i.bedrooms ? `${i.bedrooms} غرف بمساحات أصغر` : 'توزيع أصغر'})`,
          'إعادة توليد العرض بالمساحة الجديدة',
        ],
        figure: `${fitArea} م²`,
        tone: flex.has('area') ? 'go' : 'fix',
      })
    }
    // 2) البناء على مراحل: الهيكل والشبكات أوّلاً، التشطيب بعدها
    if (i.devis.lots.length) {
      const { shell, finishing } = splitPhases(i.devis.lots)
      if (shell > 0 && finishing > 0) {
        const shellFits = shell <= budget
        solutions.push({
          key: 'phased',
          title: 'البناء على مرحلتين',
          why: `المرحلة الأولى (الدراسات، الهيكل، البناء، الشبكات) ${tnd(shell)}، والتشطيب ${tnd(finishing)} لاحقاً${
            shellFits ? ' — المرحلة الأولى تدخل في الميزانية الحالية.' : ' — حتى المرحلة الأولى تتجاوز الميزانية.'
          }`,
          steps: ['تقسيم العرض إلى مرحلتين بتواريخ', 'الاتفاق على حدّ المرحلة الأولى (سكن قابل للاستعمال)', 'التشطيب من الدخل أو من تمويل لاحق'],
          figure: tnd(shell),
          tone: shellFits ? (flex.has('timing') || flex.has('phased') ? 'go' : 'fix') : 'wait',
        })
      }
    }
    // 3) تشطيب أبسط
    if (flex.has('standing')) {
      solutions.push({
        key: 'standing',
        title: 'تشطيب أبسط بنفس المساحة',
        why: 'الحريف مستعدّ يتنازل على مستوى التشطيب: حصص التلبيس والألمنيوم والنجارة والدهن والمطبخ هي أوّل ما يخفّ.',
        steps: ['توليد عرض بمستوى تشطيب أدنى ومقارنته', 'إبقاء الهيكل والشبكات كما هي'],
        tone: 'go',
      })
    }
    // 4) سدّ الفجوة نقداً أو بقسط إضافي
    if (cap && !i.cashReady) {
      const extraPayment = monthlyPayment(gap, cap.annualRatePct, cap.years)
      solutions.push({
        key: 'topup',
        title: 'سدّ الفجوة: تسبقة أكبر أو قسط أعلى',
        why: `الفجوة ${tnd(gap)} تعني إمّا تسبقة إضافية بنفس المبلغ، أو قسطاً إضافياً قدره ${tnd(extraPayment)}/شهر فوق القسط المتاح ${tnd(cap.maxPayment)} — وهذا يتجاوز سقف الاستدانة، فالبنك لن يقبله بلا دخل إضافي.`,
        steps: ['سؤال الحريف عن مساهمة عائلية أو ادّخار إضافي', 'أو ضمّ دخل القرين إن لم يُحسب كاملاً'],
        figure: tnd(gap),
        tone: 'wait',
      })
    }
  } else if (i.devis && budget > 0) {
    solutions.push({
      key: 'fits',
      title: 'العرض داخل الميزانية — المسار مفتوح',
      why: `العرض ${tnd(i.devis.total)} أقلّ من الميزانية ${tnd(budget)} بهامش ${tnd(-gap)}.`,
      steps: ['تثبيت المواصفات مع الحريف', 'الانتقال إلى ملفّ التمويل والرخص'],
      figure: tnd(-gap),
      tone: 'go',
    })
  } else if (isBuild && !i.devis) {
    solutions.push({
      key: 'devis',
      title: 'توليد عرض تقديري أوّلاً',
      why: 'بلا عرض لا نعرف إن كانت الميزانية تكفي. المواصفات موجودة، والعرض يتولّد من البوردرو في دقيقة.',
      steps: ['تثبيت المساحة ومستوى التشطيب', 'توليد العرض ومقارنته بالميزانية'],
      tone: 'fix',
    })
  }

  // 5) المسار المدعّم
  if (i.foprolosInterest || i.isFirstHome) {
    const ok: string[] = []
    if (i.isFirstHome) ok.push('أوّل مسكن')
    if (i.cnssAffiliated) ok.push(`مضمون${i.cnssYears ? ` (${i.cnssYears} سنة)` : ''}`)
    solutions.push({
      key: 'social',
      title: 'التحقّق من برنامج السكن المدعّم',
      why: `${ok.length ? ok.join(' · ') + ' — ' : ''}شروط البرنامج (سقف الدخل، أوّل مسكن، الانخراط) تُتحقَّق عند الجهة المانحة؛ اللبنة تحضّر الملفّ ولا تقرّر القبول.`,
      steps: ['شهادة عدم امتلاك مسكن', 'شهادة أجر تثبّت الدخل تحت السقف', 'إرفاق الملفّ عند تقديم القرض'],
      tone: 'wait',
    })
  }

  // 6) الأرض والرخص
  if (isBuild && i.land) {
    if (i.land.titleStatus && i.land.titleStatus !== 'titled') {
      solutions.push({
        key: 'title',
        title: 'تسوية الوضعية العقارية قبل أيّ دراسة',
        why: `${TITLE_AR[i.land.titleStatus] ?? i.land.titleStatus}: البنك لا يموّل بناءً على أرض بلا رسم صافٍ.`,
        steps: ['شهادة ملكية حديثة', i.land.titleStatus === 'undivided' ? 'قسمة أو موافقة الشركاء' : 'متابعة التسجيل'],
        tone: 'wait',
      })
    }
    if (!i.land.hasPermit) {
      const steps: string[] = []
      if (i.land.hasPlans === false) steps.push('أمثلة هندسية من مهندس معماري')
      steps.push('إيداع مطلب رخصة البناء بالبلدية')
      steps.push('في الانتظار: تجهيز ملفّ القرض بالتوازي')
      solutions.push({
        key: 'permit',
        title: i.land.hasPlans === false ? 'المسار الإداري: أمثلة ثمّ رخصة بناء' : 'رخصة البناء',
        why: 'لا تمويل ولا انطلاق أشغال بلا رخصة. الأمثلة الهندسية هي أوّل خطوة، وهي أيضاً ما يثبّت العرض التقديري.',
        steps,
        tone: 'fix',
      })
    }
  }

  // 7) ملفّ القرض
  if (cap && !i.cashReady && i.financingState === 'not_started' && cap.maxPayment > 0) {
    solutions.push({
      key: 'loan',
      title: 'تحضير ملفّ القرض',
      why: `القسط المتاح ${tnd(cap.maxPayment)}/شهر يسمح بقرض تقديري ${tnd(loan)} على ${cap.years} سنة بنسبة ${cap.annualRatePct}%. اللبنة تحضّر الملفّ وترافقه، والقرار للبنك.`,
      steps: ['جمع وثائق الدخل (شهادة عمل، بطاقات أجر، كشوف حساب)', 'اختيار صيغة التمويل المناسبة', 'إيداع الملفّ ومتابعته'],
      figure: `${tnd(cap.maxPayment)}/شهر`,
      tone: 'fix',
    })
  }

  // 8) الكراء ضغط زمني
  if (i.isRenting && i.rentTnd && cap) {
    solutions.push({
      key: 'rent',
      title: 'الكراء يضغط على الوقت',
      why: `كلّ شهر تأخير = ${tnd(i.rentTnd)} كراء يذهب. ${
        cap.maxPayment >= i.rentTnd ? `القسط المتاح (${tnd(cap.maxPayment)}) يفوق الكراء: القرض لا يزيد العبء الشهري.` : `القسط المتاح أقلّ من الكراء الحالي.`
      }`,
      steps: ['ترتيب الملفّ في أولوية الدراسة', 'تثبيت جدول زمني واقعي مع الحريف'],
      tone: 'go',
    })
  }

  // 9) الباحث عن عقار
  if (seeksProperty) {
    if (i.matchesCount > 0) {
      solutions.push({
        key: 'offers',
        title: `${i.matchesCount} عرض عقاري مقترح`,
        why: 'المحرّك وجد عروضاً مراجَعة في حدود الولاية والميزانية. الزيارة تحسم.',
        steps: ['مراجعة العروض في قسم «العروض»', 'حفظ المناسب منها وترتيب زيارة'],
        tone: 'go',
      })
    } else {
      solutions.push({
        key: 'no-offers',
        title: 'لا عرض مطابق حالياً',
        why: 'لا عقار مراجَع في حدود الولاية والميزانية.',
        steps: [
          flex.has('zone') ? 'الحريف يقبل منطقة أخرى: توسيع البحث لمعتمديات مجاورة' : 'سؤال الحريف عن قبول معتمديات مجاورة',
          'إشعار الفريق العقاري بالمطلب',
        ],
        tone: 'wait',
      })
    }
  }

  // ---------- العنوان والخطوة ----------
  const band = i.score ? `${i.score.band} · ${i.score.total}` : null
  let headline: string
  if (!i.fin) headline = 'الملفّ المالي ناقص — لا يمكن تقدير الميزانية بعد'
  else if (i.devis && gap > 0) headline = `${band ? `ملفّ ${band}: ` : ''}قابل للتمويل، لكن العرض يتجاوز الميزانية بـ${tnd(gap)}`
  else if (i.devis) headline = `${band ? `ملفّ ${band}: ` : ''}العرض داخل الميزانية — المسار مفتوح`
  else if (cap && cap.maxPayment <= 0) headline = 'القدرة على الاستدانة صفر — لا مسار بنكي دون تخفيف الأقساط'
  else headline = `${band ? `ملفّ ${band}: ` : ''}ميزانية تقديرية ${tnd(budget)}`

  const order = { go: 0, fix: 1, wait: 2 } as const
  solutions.sort((a, b) => order[a.tone] - order[b.tone])

  // الخطوة الجاية: ما يحجز الطريق أوّلاً (الأرض، الرخصة، العرض)، ثمّ أوّل ما يحتاج قراراً
  const blocking = ['title', 'permit', 'devis']
  const first =
    solutions.find((s) => blocking.includes(s.key)) ?? solutions.find((s) => s.tone === 'fix') ?? solutions[0]
  const nextStep = first ? `${first.title}: ${first.steps[0]}` : 'الاتّصال بالحريف وتثبيت موعد'

  return { headline, summary, strengths, gaps, solutions, nextStep }
}
