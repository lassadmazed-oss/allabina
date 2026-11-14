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
const VISITOR_COOKIE = 'allabina_v'

/**
 * كوكي الزائر يُكتب هنا لا في الصفحة.
 *
 * Next لا يسمح بكتابة كوكي داخل Server Component، فمحاولةُ كتابته عند
 * تسجيل حدث تُرمى وتُبتلع — فيصير لكلّ طلبٍ زائرٌ جديد، ويصير «أشخاص
 * فريدون» عدّ طلبات. الوسيط هو المكان الذي تُكتب فيه الكوكيز.
 */
function withVisitor(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return response

  // crypto العالمي لا node:crypto — الوسيط يشتغل في بيئة Edge
  const id = crypto.randomUUID()
  // تُقرأ في نفس الطلب أيضاً: الصفحة تسجّل حدثها قبل أن يعود الجواب
  request.cookies.set(VISITOR_COOKIE, id)
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 86400,
  })
  return response
}

export async function middleware(request: NextRequest) {
  // الصفحات العمومية: كوكي الزائر وحده. لا نداء مصادقة في كلّ طلب.
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    if (request.nextUrl.pathname === '/') {
      const wanted = request.headers.get('accept-language') ?? ''
      const locale = LOCALES.find((l) => wanted.toLowerCase().startsWith(l)) ?? DEFAULT_LOCALE
      const to = request.nextUrl.clone()
      to.pathname = `/${locale}`
      return withVisitor(request, NextResponse.redirect(to))
    }
    return withVisitor(request, NextResponse.next({ request }))
  }

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

/**
 * كلّ ما ليس أصلاً ثابتاً: الوسيط يكتب كوكي الزائر على الصفحات
 * العمومية، ويحرس /admin. الاستثناءات أصولٌ لا تُسجَّل ولا تُحرَس.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|.*\\..*).*)'],
}
