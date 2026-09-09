/**
 * يشغّله npm عند `npm install` (prepare): يوجّه git إلى خطّافات المستودع
 * في .githooks — فخطّاف pre-push يفحص كلّ التزام قبل أن يغادر الجهاز.
 *
 * لا يعمل على Vercel ولا في CI (لا حاجة، وقد لا يكون هناك مستودع أصلاً).
 */

import { execFileSync } from 'node:child_process'

if (process.env.VERCEL || process.env.CI) process.exit(0)
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' })
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
} catch {
  // ليس مستودع git (نسخة مضغوطة مثلاً) — لا شيء يُفعل
}
