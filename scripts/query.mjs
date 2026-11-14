// استعلام سريع على القاعدة:
//   node scripts/query.mjs "select ..." ["select ..."]
//   node scripts/query.mjs --prod "select ..."
//
// القراءة حرّة في البيئتين. أيّ جملة تكتب (insert/update/delete/alter/…)
// تمرّ على حارس الكتابة: ممنوعة على الإنتاج إلّا بـALLOW_PROD_WRITE=1.
import { assertWritable, banner, connect, loadEnv } from './lib/db.mjs'

const queries = process.argv.slice(2).filter((a) => a !== '--prod')
if (!queries.length) {
  console.error('الاستعمال: node scripts/query.mjs "select 1"')
  process.exit(1)
}

/** جملة قراءة صِرفة: لا تبدّل شيئاً مهما كان ناتجها */
const READ_ONLY = /^\s*(select|with|show|explain|table|values)\b/i
const writes = queries.filter((q) => !READ_ONLY.test(q))

const env = loadEnv()
if (writes.length) assertWritable(env, `تنفيذ ${writes.length} جملة تكتب`)
banner(env, writes.length ? 'استعلام يكتب' : 'استعلام قراءة')

const client = await connect({ env, quiet: true })
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
