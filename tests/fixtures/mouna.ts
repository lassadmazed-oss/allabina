import type { BriefInput } from '@/lib/brief'

/**
 * ملفّ منى (LB-2026-000109) كما يظهر في اللوحة: A·87، بناء فوق أرضها،
 * عرض تقديري يتجاوز الميزانية بـ18 662 د.ت. الحصص مختصرة للاختبار.
 */
export const mouna: BriefInput = {
  requestType: 'build_on_land',
  fullName: 'Mouna zoiri',
  bedrooms: 3,
  desiredAreaM2: 120,
  horizon: '6m',
  urgency: 'urgent',
  standingName: 'اقتصادي',
  delegation: 'صفاقس الجنوبية',
  landLocation: 'العين ',
  financingState: 'not_started',
  cashReady: false,
  flexibility: ['area', 'phased'],
  isFirstHome: true,
  foprolosInterest: true,
  cnssAffiliated: true,
  cnssYears: 14,
  householdSize: 5,
  dependents: 3,
  isRenting: true,
  rentTnd: 500,
  fin: {
    monthlyIncome: 2000,
    spouseIncome: 500,
    otherIncome: 0,
    existingLoans: 400,
    downPayment: 50000,
    employment: 'public',
    seniorityMonths: 120,
    isExpat: false,
  },
  land: { areaM2: 400, titleStatus: 'titled', hasWater: true, hasPower: true, hasRoad: true, hasPermit: false, hasPlans: false },
  score: { total: 87, band: 'A', maxLoan: 71733, maxBudget: 121733 },
  devis: {
    total: 140395,
    surface: 120,
    version: 2,
    lots: [
      { code: 1, name: 'الدراسات', total: 2880 },
      { code: 4, name: 'الهيكل', total: 28778 },
      { code: 9, name: 'الكهرباء', total: 7211 },
      { code: 10, name: 'الفرش', total: 10842 },
      { code: 14, name: 'الدهن', total: 5766 },
    ],
  },
  docsMissing: ['الأمثلة الهندسية', 'رخصة البناء', 'شهادة عدم امتلاك مسكن'],
  openInquiries: 0,
  matchesCount: 3,
  ageDays: 1,
}
