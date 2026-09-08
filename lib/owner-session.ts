import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * جلسة قصيرة لصاحب المطلب.
 *
 * صفحة المتابعة تتحقّق من الرمز + الهاتف معاً، لكنّها تمرّرهما في رابط
 * GET. لصفحة التعديل لا نكرّر ذلك: بعد التحقّق مرّة واحدة نضع كوكي
 * httpOnly موقّعاً يحمل معرّف المطلب وحده. لا اسم، لا هاتف، لا شيء
 * في شريط العنوان يُنسخ أو يبقى في تاريخ المتصفّح.
 *
 * المفتاح مشتقّ من SUPABASE_SECRET_KEY بفاصل مجال، فلا يحتاج صاحب
 * المشروع إلى سرّ جديد يديره، ولا يُستعمل نفس المفتاح لغرضين.
 */

const COOKIE = 'allabina_owner'
const TTL_MS = 30 * 60 * 1000
const DOMAIN = 'allabina/owner-session/v1'

export const OWNER_COOKIE = COOKIE
export const OWNER_TTL_MS = TTL_MS

function key(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('SUPABASE_SECRET_KEY غير معرّف — لا يمكن توقيع جلسة المالك')
  return createHmac('sha256', secret).update(DOMAIN).digest()
}

function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url')
}

/** رمز الجلسة: «معرّف.تاريخ الانتهاء.توقيع» */
export function issueOwnerToken(requestId: string, now = Date.now()): string {
  const payload = `${requestId}.${now + TTL_MS}`
  return `${payload}.${sign(payload)}`
}

/** يرجع معرّف المطلب إن كان التوقيع صحيحاً ولم تنتهِ المدّة، وإلّا null. */
export function readOwnerToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, expRaw, mac] = parts

  const expected = sign(`${id}.${expRaw}`)
  // المقارنة بزمن ثابت: المقارنة العادية تسرّب طول البادئة الصحيحة
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp < now) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return id
}
