// بيئة التشغيل: أيّ قاعدة بيانات نكلّم، وهل يُسمح بالكتابة فيها؟
//
// قبل 14/11/2026 كانت قاعدة واحدة للتطوير والإنتاج: ما يُبذر محلّياً يظهر
// على الموقع الحيّ في نفس اللحظة، وكلّ تجربة تلمس معطيات حرفاء حقيقيين.
// هذا الملفّ يفصلهما، ويجعل الافتراضي هو غير المؤذي.
//
// القاعدة الأساسية: **الإنتاج يُعرَف بعنوانه لا باسم الملفّ**. لو انقلب
// محتوى .env يوماً وصار يشير إلى مشروع الإنتاج، يمسكه الحارس كما لو
// استُدعي بـ--prod. اسم الملفّ نيّة؛ العنوان حقيقة.

import { readFileSync, existsSync } from 'node:fs'

/** معرّف مشروع الإنتاج في Supabase — ليس سرّاً: يظهر في عنوان كلّ طلب من المتصفّح */
export const PROD_PROJECT_REF = 'cssdvlhluaogdjcgnnga'

/** ملفّ لكلّ بيئة. كلاهما خارج git؛ القالب في .env.example */
export const ENV_FILES = { local: '.env', prod: '.env.prod' }

export function parseEnvFile(text) {
  return Object.fromEntries(
    text
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

/** هل هذا العنوان قاعدة الإنتاج؟ المحلّي يُعرف بأنّه حلقة محلّية. */
export function classify(supabaseUrl) {
  if (!supabaseUrl) return { isProd: false, isLocal: false, where: 'غير معرّف' }
  let host
  try {
    host = new URL(supabaseUrl).hostname
  } catch {
    return { isProd: false, isLocal: false, where: 'عنوان غير صالح' }
  }
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
  const isProd = host.startsWith(`${PROD_PROJECT_REF}.`)
  return { isProd, isLocal, where: isLocal ? `محلّية (${host})` : isProd ? `الإنتاج (${host})` : host }
}

/**
 * يختار البيئة ويقرأ ملفّها.
 * prod إمّا بـ--prod في سطر الأوامر وإمّا بـALLABINA_ENV=prod.
 */
export function loadEnv({ argv = process.argv.slice(2) } = {}) {
  const wantProd = argv.includes('--prod') || process.env.ALLABINA_ENV === 'prod'
  const name = wantProd ? 'prod' : 'local'
  const file = ENV_FILES[name]

  if (!existsSync(file)) {
    throw new Error(
      name === 'prod'
        ? `لا ملفّ ${file}. انسخ مفاتيح الإنتاج إليه — ولا تضعها في .env.`
        : `لا ملفّ ${file}. انسخ .env.example إليه واملأه بمفاتيح المحلّي.`
    )
  }

  const vars = parseEnvFile(readFileSync(file, 'utf8'))
  const url = vars.SUPABASE_URL ?? vars.NEXT_PUBLIC_SUPABASE_URL
  const kind = classify(url)

  // النيّة تقول شيئاً والعنوان يقول شيئاً آخر: نصدّق العنوان ونقولها بصوت عالٍ
  if (name === 'local' && kind.isProd) {
    console.warn('\n⚠  .env يشير إلى قاعدة الإنتاج. يُعامَل على هذا الأساس.\n')
  }

  return { name, file, vars, ...kind }
}

/** سطر واحد يُطبع قبل أيّ عملية: لا أحد يكتب في الإنتاج وهو يظنّ أنّه محلّي */
export function banner(env, action = '') {
  const mark = env.isProd ? '⚠ ' : ''
  console.log(`${mark}البيئة: ${env.where}${action ? ` — ${action}` : ''}`)
}

/**
 * يمنع الكتابة في الإنتاج إلّا بإذن صريح.
 * القراءة حرّة؛ الكتابة تستوجب ALLOW_PROD_WRITE=1 في محيط التشغيل —
 * متغيّر لا يُكتب في ملفّ، فلا يُنسى مفتوحاً.
 */
export function assertWritable(env, what = 'الكتابة') {
  if (!env.isProd) return
  if (process.env.ALLOW_PROD_WRITE === '1') {
    console.log(`⚠  ${what} في الإنتاج — مسموح بـALLOW_PROD_WRITE=1`)
    return
  }
  throw new Error(
    `${what} في قاعدة الإنتاج ممنوعة.\n` +
      `  للتطوير: شغّل بلا --prod (يستعمل ${ENV_FILES.local}).\n` +
      `  إن كنت فعلاً تقصد الإنتاج: ALLOW_PROD_WRITE=1 قدّام الأمر.`
  )
}

/** معاملات الاتّصال بـPostgres حسب البيئة — المحلّي بلا SSL وبمنفذ آخر */
export function pgTargets(env) {
  const url = env.vars.SUPABASE_URL ?? env.vars.NEXT_PUBLIC_SUPABASE_URL
  if (env.isLocal) {
    return [
      {
        host: '127.0.0.1',
        port: Number(env.vars.SUPABASE_DB_PORT ?? 54322),
        user: 'postgres',
        password: env.vars.DATABASE_PASSWORD || 'postgres',
        database: 'postgres',
        connectionTimeoutMillis: 10000,
      },
    ]
  }
  const ref = new URL(url).hostname.split('.')[0]
  const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
  return [
    `aws-0-${region}.pooler.supabase.com`,
    `aws-1-${region}.pooler.supabase.com`,
    `db.${ref}.supabase.co`,
  ].map((host) => ({
    host,
    port: 5432,
    user: host.includes('pooler') ? `postgres.${ref}` : 'postgres',
    password: env.vars.DATABASE_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  }))
}
