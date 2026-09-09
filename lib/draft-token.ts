/**
 * رمز المسوّدة — يجمع ملفّات استمارة واحدة قبل أن يوجد السطر الذي تنتمي إليه.
 *
 * المشكل الذي يحلّه: المواطن يرفع ملفّاً وهو في الخطوة الثالثة، والمطلب
 * لا يوجد بعد. فالخادم يولّد رمزاً، وتُجمع الملفّات تحت `drafts/<token>/`،
 * وعند الإرسال تُنقل إلى مجلّد السطر الحقيقي.
 *
 * الرمز يولّده **الخادم** لا المتصفّح، ويُتحقّق من شكله في كلّ مرّة قبل أن
 * يدخل مساراً: رمز من المتصفّح بلا تحقّق يعني `drafts/../../` — أي كتابة
 * في أيّ مكان من المخزن.
 */

export const isDraftToken = (t: string) => /^[a-z0-9]{24}$/.test(t)

export function newDraftToken(
  random: () => string = () => Math.random().toString(36).slice(2)
): string {
  let out = ''
  while (out.length < 24) out += random().replace(/[^a-z0-9]/g, '')
  return out.slice(0, 24)
}

/** ختم زمني مضغوط للمسارات: 20260909T… → 20260909143012 */
export const pathStamp = (now: Date = new Date()) =>
  now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
