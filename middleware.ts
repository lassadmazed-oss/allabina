import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/**
 * تحديث كوكي الجلسة في كلّ طلب — شرط ضروري لعمل @supabase/ssr —
 * وحماية /admin من الزوّار غير المصادَقين قبل بلوغ الصفحة.
 * التحقّق من الدور يبقى في الخادم (lib/auth.ts) لأنّ الوسيط لا يقرأ قاعدة البيانات.
 */
export async function middleware(request: NextRequest) {
  // الجذر "/" ليس صفحة: الموقع العمومي تحت /ar و /fr.
  if (request.nextUrl.pathname === '/') {
    const wanted = request.headers.get('accept-language') ?? ''
    const locale =
      LOCALES.find((l) => wanted.toLowerCase().startsWith(l)) ?? DEFAULT_LOCALE
    const to = request.nextUrl.clone()
    to.pathname = `/${locale}`
    return NextResponse.redirect(to)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const isLogin = pathname === '/admin/login'

  if (!user && !isLogin) {
    const to = request.nextUrl.clone()
    to.pathname = '/admin/login'
    to.search = ''
    if (pathname !== '/admin') to.searchParams.set('next', pathname + search)
    return NextResponse.redirect(to)
  }

  if (user && isLogin) {
    const to = request.nextUrl.clone()
    to.pathname = '/admin'
    to.search = ''
    return NextResponse.redirect(to)
  }

  return response
}

export const config = { matcher: ['/', '/admin/:path*'] }
