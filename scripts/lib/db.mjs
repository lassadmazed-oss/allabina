// اتّصال مباشر بقاعدة البيانات لسكربتات الصيانة.
//
// كلّ اتّصال يمرّ على حارس البيئة: الافتراضي محلّي، والإنتاج يحتاج --prod،
// والكتابة في الإنتاج تحتاج ALLOW_PROD_WRITE=1 فوق ذلك. انظر lib/env.mjs.
import pg from 'pg'
import { assertWritable, banner, loadEnv, pgTargets } from './env.mjs'

export { loadEnv, assertWritable, banner }

/** يبقى للتوافق مع السكربتات القديمة — يرجع متغيّرات البيئة المختارة */
export function readEnv() {
  return loadEnv().vars
}

/**
 * يجرّب مضيفات البيئة بالترتيب — أوّل من يستجيب يفوز.
 * `write`: صفة العملية (مثلاً «تطبيق الهجرات»). تمريرها يفعّل حارس الكتابة.
 */
export async function connect({ env = loadEnv(), write = null, quiet = false } = {}) {
  if (write) assertWritable(env, write)
  if (!quiet) banner(env, write ?? 'قراءة')

  let lastError = null
  for (const target of pgTargets(env)) {
    const client = new pg.Client(target)
    try {
      await client.connect()
      return client
    } catch (e) {
      lastError = e
      try {
        await client.end()
      } catch {}
    }
  }
  throw new Error(
    `تعذّر الاتّصال بقاعدة ${env.where}${lastError ? ` — ${lastError.message}` : ''}` +
      (env.isLocal ? '\n  المحلّي يحتاج الحزمة مشتغلة: npm run db:start' : '')
  )
}
