// اتّصال مباشر بقاعدة البيانات لسكربتات الصيانة — نفس منطق apply-migrations.
import { readFileSync } from 'node:fs'
import pg from 'pg'

export function readEnv() {
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

/** يجرّب الـpooler ثمّ الاتّصال المباشر — أوّل مضيف يستجيب يفوز. */
export async function connect() {
  const env = readEnv()
  const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0]
  const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
  const hosts = [
    `aws-0-${region}.pooler.supabase.com`,
    `aws-1-${region}.pooler.supabase.com`,
    `db.${ref}.supabase.co`,
  ]
  for (const host of hosts) {
    const client = new pg.Client({
      host,
      port: 5432,
      user: host.includes('pooler') ? `postgres.${ref}` : 'postgres',
      password: env.DATABASE_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })
    try {
      await client.connect()
      return client
    } catch {
      try { await client.end() } catch {}
    }
  }
  throw new Error('تعذّر الاتّصال بقاعدة البيانات')
}
