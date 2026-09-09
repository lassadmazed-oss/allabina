// استعلام سريع على القاعدة: node scripts/query.mjs "select ..." ["select ..."]
import { connect } from './lib/db.mjs'

const queries = process.argv.slice(2)
if (!queries.length) {
  console.error('الاستعمال: node scripts/query.mjs "select 1"')
  process.exit(1)
}

const client = await connect()
try {
  for (const sql of queries) {
    const r = await client.query(sql)
    console.log('—', sql.length > 70 ? sql.slice(0, 70) + '…' : sql)
    if (r.rows.length) console.table(r.rows)
    else console.log('  (لا نتائج · ' + (r.rowCount ?? 0) + ' سطراً)')
  }
} finally {
  await client.end()
}
