// تطبيق ملفّات supabase/migrations على قاعدة البيانات بالترتيب.
// الاستعمال: node scripts/apply-migrations.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0]
const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
const hosts = [
  `aws-0-${region}.pooler.supabase.com`,
  `aws-1-${region}.pooler.supabase.com`,
  `db.${ref}.supabase.co`,
]

const dir = 'supabase/migrations'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

async function connect() {
  for (const host of hosts) {
    const user = host.includes('pooler') ? `postgres.${ref}` : 'postgres'
    const client = new pg.Client({
      host,
      port: 5432,
      user,
      password: env.DATABASE_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })
    try {
      await client.connect()
      console.log(`متّصل عبر ${host}`)
      return client
    } catch (e) {
      console.log(`تعذّر عبر ${host}: ${e.message}`)
    }
  }
  throw new Error('تعذّر الاتصال بقاعدة البيانات عبر كلّ المسارات المجرّبة')
}

const client = await connect()
try {
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
  console.log('\nالجداول:', rows.map((r) => r.table_name).join(', '))

  const counts = await client.query(`
    select (select count(*) from governorates)     as governorates,
           (select count(*) from delegations)      as delegations,
           (select count(*) from price_references) as prices,
           (select count(*) from app_settings)     as settings
  `)
  console.log('البيانات:', counts.rows[0])
} finally {
  await client.end()
}
