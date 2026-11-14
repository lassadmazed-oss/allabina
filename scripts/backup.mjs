// نسخة احتياطية من الإنتاج، واسترجاعها على المحلّي للتثبّت من أنّها تشتغل.
//
//   npm run db:backup                 ← ينسخ الإنتاج إلى backups/<ختم>/
//   npm run db:backup -- --restore    ← يسترجع آخر نسخة على المحلّي ويقارن
//   npm run db:backup -- --restore <ختم>
//   npm run db:backup -- --list
//
// نسخة لا تُسترجَع ليست نسخة. لذلك الاسترجاع هنا ليس أمراً منفصلاً بل
// الجزء الثاني من نفس السكربت، وينتهي بمقارنة عدد الأسطر جدولاً جدولاً
// بين المصدر والمسترجَع — فإن نقص سطر واحد يظهر.
//
// الاسترجاع لا يمسّ الإنتاج أبداً: الوجهة محلّية حصراً، والشرط مكتوب
// في الشفرة لا في التعليمات.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ENV_FILES, classify, loadEnv, parseEnvFile } from './lib/env.mjs'
import { readFileSync } from 'node:fs'
import { connect } from './lib/db.mjs'

const ROOT = 'backups'
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

function listBackups() {
  if (!existsSync(ROOT)) return []
  return readdirSync(ROOT)
    .filter((d) => statSync(join(ROOT, d)).isDirectory())
    .sort()
    .reverse()
}

/** عنوان الاتّصال بالإنتاج — يُبنى ولا يُطبع أبداً */
function prodUrl() {
  if (!existsSync(ENV_FILES.prod)) throw new Error(`لا ملفّ ${ENV_FILES.prod}`)
  const vars = parseEnvFile(readFileSync(ENV_FILES.prod, 'utf8'))
  const kind = classify(vars.SUPABASE_URL)
  if (!kind.isProd) throw new Error(`${ENV_FILES.prod} لا يشير إلى الإنتاج — ${kind.where}`)
  const ref = new URL(vars.SUPABASE_URL).hostname.split('.')[0]
  const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
  const pass = encodeURIComponent(vars.DATABASE_PASSWORD)
  return `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:5432/postgres`
}

const cli = (args) =>
  execFileSync('npx', ['--yes', 'supabase', ...args], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    shell: true,
  })

/** أسماء الجداول وأعداد أسطرها — بصمة نقارن بها قبل وبعد */
async function fingerprint(env) {
  const client = await connect({ env, quiet: true })
  try {
    const { rows } = await client.query(`
      select c.relname as t,
             (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text::int as n
        from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
       where ns.nspname = 'public' and c.relkind = 'r'
       order by 1`)
    return Object.fromEntries(rows.map((r) => [r.t, r.n]))
  } finally {
    await client.end()
  }
}

// ──────────────────────────────────────────────────────────── العرض
if (has('--list')) {
  const list = listBackups()
  if (!list.length) console.log('لا نسخ بعد.')
  for (const d of list) {
    const files = readdirSync(join(ROOT, d))
    const size = files.reduce((s, f) => s + statSync(join(ROOT, d, f)).size, 0)
    console.log(`  ${d}   ${files.length} ملفّات   ${(size / 1048576).toFixed(1)} ميغا`)
  }
  process.exit(0)
}

// ──────────────────────────────────────────────────────── الاسترجاع
if (has('--restore')) {
  const want = argv[argv.indexOf('--restore') + 1]
  const pick = want && !want.startsWith('--') ? want : listBackups()[0]
  if (!pick) throw new Error('لا نسخة لاسترجاعها. شغّل npm run db:backup أوّلاً.')
  const dir = join(ROOT, pick)
  if (!existsSync(dir)) throw new Error(`لا نسخة باسم ${pick}`)

  const env = loadEnv({ argv: [] }) // بلا --prod: الوجهة محلّية دائماً
  if (!env.isLocal) {
    throw new Error(
      `الاسترجاع يكتب على ${env.where}. الوجهة يلزم تكون محلّية — ` +
        'شغّل الحزمة المحلّية (npm run db:start) واجعل .env يشير إليها.'
    )
  }

  const project = parseEnvFile(readFileSync('supabase/config.toml', 'utf8').replace(/"/g, ''))
  const container = `supabase_db_${(project.project_id ?? 'al-labina').trim()}`

  console.log(`استرجاع ${pick} على ${env.where} …`)

  // تفريغ schema public بأنفسنا لا بـ`supabase db reset`: الأخير يعيد تشغيل
  // الحاويات، والنسخة المسترجَعة تحمل CREATE TABLE فتحتاج أرضاً خالية لا مهاجَرة.
  process.stdout.write('  تفريغ schema public … ')
  const wipe = await connect({ env, quiet: true })
  try {
    await wipe.query('drop schema if exists public cascade; create schema public;')
    await wipe.query('grant usage on schema public to anon, authenticated, service_role;')
    await wipe.query('grant all on schema public to postgres;')
  } finally {
    await wipe.end()
  }
  console.log('تمّ')

  for (const f of ['schema.sql', 'data.sql']) {
    const path = join(dir, f)
    if (!existsSync(path)) continue
    process.stdout.write(`  ${f} … `)
    execFileSync(
      'docker',
      ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=0', '-q'],
      { input: readFileSync(path), stdio: ['pipe', 'ignore', 'ignore'], maxBuffer: 512 * 1024 * 1024 }
    )
    console.log('تمّ')
  }

  const before = JSON.parse(readFileSync(join(dir, 'fingerprint.json'), 'utf8'))
  const after = await fingerprint(env)
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  const bad = names.filter((t) => (before[t] ?? 0) !== (after[t] ?? 0))

  console.log(`\nجداول: ${names.length} · مطابقة: ${names.length - bad.length}`)
  if (bad.length) {
    console.log('\n⚠ فروقات:')
    for (const t of bad) console.log(`  ${t.padEnd(28)} المصدر ${before[t] ?? '—'} · المسترجَع ${after[t] ?? '—'}`)
    process.exitCode = 1
  } else {
    console.log('✓ الاسترجاع مطابق للمصدر سطراً سطراً')
  }
  process.exit()
}

// ─────────────────────────────────────────────────────────── النسخ
const tag = stamp()
const dir = join(ROOT, tag)
mkdirSync(dir, { recursive: true })
const url = prodUrl()

console.log(`نسخ الإنتاج إلى ${dir} …`)
process.stdout.write('  البنية … ')
writeFileSync(join(dir, 'schema.sql'), cli(['db', 'dump', '--db-url', url]))
console.log('تمّ')

process.stdout.write('  المعطيات … ')
writeFileSync(join(dir, 'data.sql'), cli(['db', 'dump', '--db-url', url, '--data-only']))
console.log('تمّ')

process.stdout.write('  البصمة … ')
const prodEnv = loadEnv({ argv: ['--prod'] })
writeFileSync(join(dir, 'fingerprint.json'), JSON.stringify(await fingerprint(prodEnv), null, 1))
console.log('تمّ')

const sizes = readdirSync(dir).map((f) => `${f} ${(statSync(join(dir, f)).size / 1048576).toFixed(1)}م`)
console.log(`\n✓ ${tag} — ${sizes.join(' · ')}`)
console.log('  للتثبّت من أنّها تشتغل: npm run db:backup -- --restore')
