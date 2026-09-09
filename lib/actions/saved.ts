import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * تأكيد بعد الحفظ.
 *
 * شاشات الإدارة فيها عشرات الاستمارات تحفظ بصمت: الصفحة تُعاد ولا شيء
 * يقول «تمّ». فيبقى الموظّف يخمّن، ويعيد الحفظ مرّتين احتياطاً.
 *
 * الطريقة: بعد نجاح الفعل نعيد التوجيه إلى نفس الصفحة مع `?saved=<مفتاح>`،
 * ويلتقطه SaveToast فيعرض شريطاً يختفي وحده وينظّف العنوان.
 *
 * الصفحة تُقرأ من رأس referer لا من حقل مخفيّ: هكذا يعمل التأكيد في كلّ
 * استمارة قائمة بلا تعديلها واحدة واحدة. ونتحقّق أنّها من داخل الموقع.
 */
export async function savedRedirect(key: string): Promise<never> {
  const h = await headers()
  const referer = h.get('referer') ?? ''

  let target = '/admin'
  try {
    const url = new URL(referer)
    const host = h.get('host')
    // نفس المضيف وداخل لوحة القيادة — لا نتبع عنواناً خارجياً
    if (host && url.host === host && url.pathname.startsWith('/admin')) {
      url.searchParams.set('saved', key)
      target = url.pathname + url.search
    }
  } catch {
    // بلا referer صالح: نبقى على السلوك القديم بلا تأكيد
  }

  redirect(target)
}
