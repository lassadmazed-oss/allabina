import type { Locale } from '@/lib/i18n'

/**
 * الهويّة القانونية وقنوات الاتّصال — الأنواع والصياغة، بلا قاعدة بيانات.
 *
 * منفصل عن `lib/legal.ts` (الذي يقرأ القاعدة) لأنّ هذا منطق خالص يستحقّ
 * اختباراً: رابط واتساب خاطئ يعني حريفاً ما يوصلش، والخطأ ما يظهرش في
 * الشاشة — الزرّ يبقى موجوداً ويفتح رقماً غير موجود.
 */
export type LegalIdentity = {
  nameAr: string
  nameFr: string
  formAr: string
  formFr: string
  uniqueId: string
  registerNo: string
  capitalTnd: number | null
  activityCode: string
  activityAr: string
  activityFr: string
  addressAr: string
  addressFr: string
  publishedOn: string
  activitySince: string
  manager: string
  verifyUrl: string
}

export type PlatformContact = {
  phone: string
  whatsapp: string
  email: string
  hours: string
}

/** الخانة الفارغة تعني «ما نعرفوش» فلا تُعرض — لا فارغة ولا بشرطة */
export const EMPTY_IDENTITY: LegalIdentity = {
  nameAr: '',
  nameFr: '',
  formAr: '',
  formFr: '',
  uniqueId: '',
  registerNo: '',
  capitalTnd: null,
  activityCode: '',
  activityAr: '',
  activityFr: '',
  addressAr: '',
  addressFr: '',
  publishedOn: '',
  activitySince: '',
  manager: '',
  verifyUrl: '',
}

/** الاسم والعنوان والنشاط حسب لغة الصفحة — الفرنسية ترجع للعربية إن غابت */
export function legalInLocale(l: LegalIdentity, locale: Locale) {
  const pick = (ar: string, fr: string) => (locale === 'fr' ? fr || ar : ar)
  return {
    name: pick(l.nameAr, l.nameFr),
    form: pick(l.formAr, l.formFr),
    address: pick(l.addressAr, l.addressFr),
    activity: pick(l.activityAr, l.activityFr),
  }
}

/** `tel:` يقبل الرقم المحلّي كما هو — نشيل منه ما ليس رقماً ولا علامة زائد */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * `wa.me` يستوجب الصيغة الدولية بلا علامة زائد وبلا أصفار بادئة.
 * الرقم التونسي ثمانية أعداد فنسبقه بـ216؛ والمكتوب بالصيغة الدولية
 * (بـ+ أو 00) يُنظَّف ولا يُسبَق مرّة ثانية.
 */
export function waHref(whatsapp: string, text?: string): string | null {
  let digits = whatsapp.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 8) digits = `216${digits}`
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
