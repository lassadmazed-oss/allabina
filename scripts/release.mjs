/**
 * النشر الآمن — الطريق الوحيد إلى الإنتاج.
 *
 *   npm run release              ينشر HEAD إلى الإنتاج
 *   npm run release:preview      نشر معاينة (رابط مؤقّت، لا يمسّ الموقع)
 *   npm run rollback [prod/…]    يرجع إلى الدبّوس السابق (أو دبّوس بعينه)
 *   npm run release -- --status  يعرض الدبابيس الأخيرة
 *
 * صمّامات الأمان، بالترتيب:
 *   1. الإنتاج من الفرع main ومن التزام موجود على GitHub — لا شفرة محلّية.
 *   2. تُنشر شجرة الالتزام لا مجلّد العمل (worktree مؤقّت).
 *   3. tsc والاختبارات تمرّ على تلك الشجرة قبل الرفع.
 *   4. بعد الرفع اختبار دخاني على الموقع الحيّ؛ إن فشل رجعنا تلقائياً
 *      إلى الدبّوس السابق.
 *   5. دبّوس: وسم prod/<تاريخ> على الالتزام برابط النشر، يُدفع إلى GitHub —
 *      فلكلّ ما كان حيّاً يوماً مسمار نرجع إليه بأمر واحد.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  REPO,
  SITE,
  checkTree,
  exportTree,
  fail,
  git,
  pin,
  pins,
  removeExport,
  smoke,
  vercel,
} from './lib/release.mjs'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const mode = has('--rollback') ? 'rollback' : has('--status') ? 'status' : has('--preview') ? 'preview' : 'prod'

function showPins(n = 6) {
  const list = pins().slice(0, n)
  if (!list.length) return console.log('  (لا دبابيس بعد)')
  for (const p of list) console.log(`  ${p.tag}  ${p.commit}  ${p.url}${p.note ? `  — ${p.note}` : ''}`)
}

function deployedUrl(out) {
  const m = out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/)
  const insp = out.match(/https:\/\/vercel\.com\/[^\s"']+/)
  return { url: m?.[0] ?? null, inspector: insp?.[0] ?? '' }
}

async function deploy(target) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const sha = git(['rev-parse', 'HEAD'])
  const subject = git(['log', '-1', '--format=%s'])
  const author = git(['log', '-1', '--format=%an'])
  console.log(`\n▲ ${target === 'prod' ? 'نشر إنتاجي' : 'نشر معاينة'} — ${sha.slice(0, 7)} «${subject}»\n`)

  if (target === 'prod') {
    if (branch !== 'main') fail(`الإنتاج يُنشر من main لا من ${branch}`)
    try {
      git(['fetch', '-q', 'origin', 'main'], { stdio: 'ignore' })
    } catch {
      fail('تعذّر الوصول إلى GitHub للتحقّق من أنّ الالتزام مدفوع')
    }
    try {
      git(['merge-base', '--is-ancestor', sha, 'origin/main'], { stdio: 'ignore' })
    } catch {
      fail('هذا الالتزام ليس على GitHub بعد. ادفعه أوّلاً (git push) ثمّ أعد المحاولة')
    }
  }

  // 2 + 3: شجرة الالتزام وحدها، وتمرّ الفحوص عليها
  console.log('تصدير شجرة الالتزام وفحصها:')
  const { dir } = exportTree(sha)
  let failedStep = null
  let result = { code: 1, out: '' }
  try {
    failedStep = checkTree(dir)
    if (!failedStep) {
      fs.mkdirSync(path.join(dir, '.vercel'), { recursive: true })
      fs.copyFileSync(path.join(REPO, '.vercel', 'project.json'), path.join(dir, '.vercel', 'project.json'))
      // الوصلة تُفكّ قبل الرفع: الأرشيف لا يرى node_modules أصلاً، لكن لا نراهن
      fs.rmdirSync(path.join(dir, 'node_modules'))
      console.log('الرفع إلى Vercel …')
      result = vercel(
        [
          'deploy',
          ...(target === 'prod' ? ['--prod'] : []),
          '--archive=tgz',
          '-m', `githubCommitSha=${sha}`,
          '-m', `githubCommitMessage=${subject}`,
          '-m', `githubCommitRef=${branch}`,
          '-m', 'githubOrg=lassadmazed-oss',
          '-m', 'githubRepo=allabina',
          '-m', `githubCommitAuthorName=${author}`,
        ],
        { cwd: dir },
      )
    }
  } finally {
    removeExport(dir)
  }
  if (failedStep) fail(`الفحص «${failedStep}» فشل على الالتزام ${sha.slice(0, 7)} — لم يُرفع شيء`)
  const { url, inspector } = deployedUrl(result.out)
  if (result.code !== 0 || !url) {
    console.log(result.out.trim().split('\n').slice(-25).join('\n'))
    fail('الرفع فشل — الموقع الحيّ لم يتغيّر')
  }
  console.log(`  رُفع: ${url}`)

  if (target !== 'prod') {
    console.log('\n✓ معاينة جاهزة (روابط المعاينة محميّة بتسجيل الدخول إلى Vercel).')
    return
  }

  // 4: اختبار دخاني على الموقع الحيّ، وإلّا رجوع تلقائي
  process.stdout.write(`الاختبار الدخاني على ${SITE} … `)
  const bad = await smoke()
  if (bad.length) {
    console.log('فشل')
    for (const b of bad) console.log(`  ${b}`)
    const previous = pins()[0]
    if (previous?.url) {
      console.log(`رجوع تلقائي إلى الدبّوس السابق ${previous.tag} (${previous.url}) …`)
      const r = vercel(['rollback', previous.url, '--timeout', '3m'])
      console.log(r.code === 0 ? '  تمّ الرجوع' : `  الرجوع فشل:\n${r.out.trim().split('\n').slice(-10).join('\n')}`)
    } else {
      console.log('لا دبّوس سابق للرجوع إليه — عالج الخلل وأعد النشر')
    }
    fail('النشر تراجع عنه لأنّ الموقع لم يجب كما يجب')
  }
  console.log('نجح')

  // 5: الدبّوس
  const tag = pin(sha, url, inspector, subject)
  console.log(`\n✓ الإنتاج على ${sha.slice(0, 7)} — دبّوس ${tag}\n`)
  showPins(4)
}

async function rollback() {
  const list = pins()
  const wanted = argv.find((a) => a.startsWith('prod/'))
  const target = wanted ? list.find((p) => p.tag === wanted) : list[1]
  if (!target) fail(wanted ? `لا دبّوس باسم ${wanted}` : 'لا دبّوس سابق: نشر واحد فقط أو لا شيء')
  console.log(`\n↩ رجوع إلى ${target.tag} — ${target.commit} ${target.note}\n  ${target.url}\n`)
  const r = vercel(['rollback', target.url, '--timeout', '3m'])
  if (r.code !== 0) {
    console.log(r.out.trim().split('\n').slice(-15).join('\n'))
    fail('الرجوع فشل')
  }
  process.stdout.write(`الاختبار الدخاني على ${SITE} … `)
  const bad = await smoke()
  if (bad.length) {
    console.log('فشل')
    for (const b of bad) console.log(`  ${b}`)
    fail('رجعنا لكنّ الموقع لا يجيب كما يجب — تحقّق يدوياً')
  }
  console.log('نجح')
  const tag = pin(git(['rev-parse', target.commit]), target.url, '', `رجوع إلى ${target.tag}`)
  console.log(`\n✓ الإنتاج الآن على ${target.commit} — دبّوس ${tag}\n`)
  showPins(4)
}

if (mode === 'status') {
  console.log('\nالدبابيس الأخيرة (الأعلى هو ما على الإنتاج):')
  showPins(8)
} else if (mode === 'rollback') {
  await rollback()
} else {
  await deploy(mode)
}
