// تطبيق ملفّات supabase/migrations على قاعدة البيانات بالترتيب.
//
//   npm run migrate              على القاعدة المحلّية (.env)
//   npm run migrate -- --reset   يمسح schema public ثمّ يعيد البناء (محلّي فقط)
//   npm run migrate -- --prod    على الإنتاج — يحتاج ALLOW_PROD_WRITE=1
//
// الهجرات تُعاد كلّها في كلّ مرّة، فيلزم تبقى قابلة للتكرار: insert بـ
// on conflict، وcreate بـif not exists أو or replace.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { connect, loadEnv } from './lib/db.mjs'

const dir = 'supabase/migrations'
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const reset = process.argv.includes('--reset')
const env = loadEnv()

// المسح الكامل محلّي حصراً — لا يكفيه إذن الكتابة، لأنّه يمحو ولا يضيف
if (reset && !env.isLocal) {
  console.error(`--reset يمحو كلّ الجداول. الوجهة ${env.where} ليست محلّية.`)
  process.exit(1)
}

const client = await connect({ env, write: reset ? 'إعادة بناء القاعدة' : 'تطبيق الهجرات' })
client.on('notice', (n) => n.message && console.log(`  ملاحظة: ${n.message}`))

try {
  console.log(`\n${files.length} ملفّ هجرة\n`)
  if (reset) {
    process.stdout.write('مسح schema public ... ')
    await client.query('drop schema if exists public cascade; create schema public;')
    await client.query('grant usage on schema public to anon, authenticated, service_role;')
    await client.query('grant all on schema public to postgres;')
    // الصلاحيات الافتراضية كما يضبطها Supabase على المشروع السحابي.
    // الجداول وحدها لا تكفي: عمود bigserial يحتاج صلاحية على المتتالية،
    // وبدونها يفشل كلّ insert بـ«permission denied for sequence» — خطأ
    // لا يظهر إلّا عند أوّل كتابة حقيقية من التطبيق.
    for (const kind of ['tables', 'sequences', 'functions']) {
      await client.query(
        `alter default privileges in schema public grant all on ${kind} to anon, authenticated, service_role;`
      )
    }
    // حسابات auth تعيش خارج schema public فلا يمسحها المسح أعلاه. وبقاؤها
    // ليس إزعاجاً فقط (البذر يفشل بـemail_exists): اختبار استرجاع نسخة من
    // الإنتاج يترك هنا بُرُد حرفاء حقيقيين. على المحلّي نمحوها كلّها.
    const { rowCount } = await client.query('truncate auth.users cascade')
    console.log(`تمّ (ومُحيت حسابات auth: ${rowCount ?? 'كلّها'})`)
  }

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8')
    process.stdout.write(`تطبيق ${file} ... `)
    await client.query(sql)
    console.log('تمّ')
  }

  const { rows } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `)
  console.log(`\nالجداول (${rows.length}):`, rows.map((r) => r.table_name).join(', '))

  const counts = await client.query(`
    select (select count(*) from governorates)     as governorates,
           (select count(*) from delegations)      as delegations,
           (select count(*) from price_references) as prices,
           (select count(*) from app_settings)     as settings
  `)
  console.log('البيانات المرجعية:', counts.rows[0])

  if (reset) {
    console.log('\nالقاعدة خالية من الحسابات. لإعادة حساب المطوّر والبيانات التجريبية:')
    console.log("  printf 'labina-dev-2026\\n' | node scripts/create-owner.mjs dev@allabina.invalid")
    console.log('  node scripts/seed-demo.mjs')
  }
} finally {
  await client.end()
}
