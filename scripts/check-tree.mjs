/**
 * يفحص شجرة التزام (لا مجلّد العمل): تصدير مؤقّت ثمّ tsc والاختبارات.
 *
 *   node scripts/check-tree.mjs [rev]      الافتراضي HEAD
 *
 * يستعمله خطّاف pre-push على كلّ التزام يُدفع، وscripts/release.mjs قبل
 * الرفع. عمل الجلسات الأخرى غير الملتزَم لا يؤثّر فيه ولا يتأثّر به.
 */

import { checkTree, exportTree, fail, git, removeExport } from './lib/release.mjs'

const rev = process.argv[2] || 'HEAD'
const { sha, dir } = exportTree(rev)
console.log(`فحص الالتزام ${sha.slice(0, 7)} «${git(['log', '-1', '--format=%s', sha])}»`)
let failed = null
try {
  failed = checkTree(dir)
} finally {
  removeExport(dir)
}
if (failed) fail(`«${failed}» فشل على ${sha.slice(0, 7)}. لا يُدفع ولا يُنشر التزام لا يمرّ الفحص`)
console.log(`✓ ${sha.slice(0, 7)} يمرّ tsc والاختبارات`)
