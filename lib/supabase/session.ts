import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL أو NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY غير معرّفين في .env')
}

/**
 * عميل مربوط بجلسة المستعمل عبر الكوكيز (مفتاح publishable، يحترم RLS).
 * مقابل `db` في lib/supabase/server.ts الذي يستعمل المفتاح السرّي ويتجاوز RLS.
 */
export async function createServerSupabase() {
  const store = await cookies()

  return createServerClient(url!, key!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // الكتابة ممنوعة داخل Server Component — يتكفّل middleware بتحديث الكوكيز.
        }
      },
    },
  })
}
