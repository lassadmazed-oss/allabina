/**
 * الأرقام كما تصل من لوحة مفاتيح عربية.
 *
 * لوحة عربية على الهاتف قد تكتب ٠١٢٣ (هندية) أو ۰۱۲۳ (فارسية)، والخادم
 * لا يفهم إلّا 0-9: رقم هاتف صحيح كان يُرفض بـ«غير صحيح» وصاحبه لا يفهم
 * لماذا. التطبيع في مكان واحد، يستعمله الحقل والمخطّط معاً.
 */

const EASTERN = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => {
    const i = EASTERN.indexOf(c)
    return String(i >= 0 ? i : PERSIAN.indexOf(c))
  })
}

/**
 * رقم هاتف كما يُحفظ: أرقام لاتينية بلا فراغات ولا شرطات ولا أقواس ولا
 * نقاط، و«+» في أوّله وحده. «00216 …» تصير «+216 …».
 */
export function normalizePhone(s: string): string {
  // ما قبل أوّل رقم أو + (أقواس، فراغات) لا يعني شيئاً
  const t = toAsciiDigits(s).trim().replace(/^[^\d+]+/, '')
  const international = t.startsWith('+') || t.startsWith('00')
  const digits = t.replace(/^00/, '').replace(/\D/g, '')
  return (international ? '+' : '') + digits
}

/** 8 أرقام محلّية أو دولي حتّى 15 رقماً */
export function isValidPhone(s: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(s))
}
