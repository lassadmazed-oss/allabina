/**
 * أدوات النشر الآمن — يستعملها scripts/release.mjs و scripts/check-tree.mjs.
 *
 * القاعدة الواحدة: ما يُفحص وما يُنشر هو **شجرة التزام** لا مجلّد العمل.
 * مجلّد العمل قد يحمل عمل جلسة أخرى نصف منتهٍ (هكذا فشل بناء 2026-09-09:
 * ملفّ يستورد أيقونة لم تُكتب بعد)، أمّا الالتزام فقرار مكتمل.
 *
 * التصدير: worktree منفصل في المجلّد المؤقّت + وصلة (junction) إلى
 * node_modules الحقيقي كي يعمل tsc وvitest دون تثبيت. الوصلة تُفكّ قبل أيّ
 * حذف تكراري — حذف مجلّد فيه وصلة قد يتبعها إلى node_modules نفسه.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
/** الموقع الذي يراه الناس — الاختبار الدخاني يضربه بعد النشر */
export const SITE = process.env.RELEASE_SITE || 'https://www.allabina.site'
export const SMOKE_PATHS = ['/ar', '/fr', '/ar/demande', '/ar/soutien', '/ar/realisations']
const BRAND = /اللَّبنة|اللبنة/
/** الدبابيس: وسم لكلّ نشر إنتاجي، رسالته رابط النشر */
export const PIN_PREFIX = 'prod/'

export function git(args, opts = {}) {
  // مع stdio: 'ignore' لا مخرجات — نعيد نصّاً فارغاً لا null
  const out = execFileSync('git', args, { cwd: REPO, encoding: 'utf8', ...opts })
  return (out ?? '').toString().trim()
}

export function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

/** يقرأ .env المحلّي (لا يُحمَّل في الإنتاج) — للمفتاح VERCEL_TOKEN إن وُجد */
export function dotenv() {
  try {
    const s = fs.readFileSync(path.join(REPO, '.env'), 'utf8')
    return Object.fromEntries(
      s
        .split(/\r?\n/)
        .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  } catch {
    return {}
  }
}

/** يصدّر شجرة الالتزام rev إلى worktree مؤقّت ويربط node_modules بوصلة */
export function exportTree(rev) {
  const sha = git(['rev-parse', '--verify', `${rev}^{commit}`])
  const dir = path.join(os.tmpdir(), `allabina-${sha.slice(0, 10)}`)
  removeExport(dir) // بقايا محاولة سابقة انقطعت
  git(['worktree', 'add', '--detach', dir, sha], { stdio: 'ignore' })
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
  return { sha, dir }
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

/** يفكّ الوصلة ثمّ يزيل الـworktree — بهذا الترتيب حصراً */
export function removeExport(dir) {
  const link = path.join(dir, 'node_modules')
  if (isLink(link)) fs.rmdirSync(link)
  if (isLink(link)) fail(`تعذّر فكّ الوصلة ${link} — لن أحذف المجلّد كي لا يُمسّ node_modules الحقيقي`)
  try {
    git(['worktree', 'remove', '--force', dir], { stdio: 'ignore' })
  } catch {}
  try {
    git(['worktree', 'prune'], { stdio: 'ignore' })
  } catch {}
  if (fs.existsSync(dir) && !isLink(link)) {
    // ويندوز يمسك المجلّد لحظةً بعد أن يفرغه git — محاولات متباعدة، والفشل
    // تحذير لا سقوط: التنظيف لا يُسقط نشراً نجح
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    } catch {
      console.log(`  (بقي مجلّد مؤقّت فارغ لم يُحذف: ${dir} — لا يضرّ، واحذفه متى شئت)`)
    }
  }
}

/** tsc ثمّ vitest داخل الشجرة المصدَّرة. يعيد اسم الخطوة الفاشلة أو null */
export function checkTree(dir) {
  const steps = [
    ['tsc --noEmit', [path.join('node_modules', 'typescript', 'bin', 'tsc'), '--noEmit']],
    ['vitest run', [path.join('node_modules', 'vitest', 'vitest.mjs'), 'run']],
  ]
  for (const [name, args] of steps) {
    process.stdout.write(`  ${name} … `)
    const r = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', maxBuffer: 64e6 })
    if (r.status !== 0) {
      console.log('فشل')
      const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n')
      console.log(out.slice(-40).join('\n'))
      return name
    }
    console.log('نجح')
  }
  return null
}

function globalVercelEntry() {
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
    const p = path.join(root, 'vercel', 'dist', 'index.js')
    return fs.existsSync(p) ? p : null
  } catch {
    return null
  }
}

/**
 * يشغّل Vercel CLI. المفتاح من VERCEL_TOKEN (البيئة أو .env) إن وُجد، وإلّا
 * جلسة `vercel login`. لا يُطبع الأمر أبداً كي لا يتسرّب المفتاح.
 */
export function vercel(args, { cwd = REPO } = {}) {
  const token = process.env.VERCEL_TOKEN || dotenv().VERCEL_TOKEN
  const full = [...args, '--yes', ...(token ? ['--token', token] : [])]
  const entry = globalVercelEntry()
  const r = entry
    ? spawnSync(process.execPath, [entry, ...full], { cwd, encoding: 'utf8', maxBuffer: 64e6 })
    : spawnSync('vercel', full, { cwd, encoding: 'utf8', shell: true, maxBuffer: 64e6 })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

/** يضرب الصفحات الأساسية حتّى تجيب 200 وفيها اسم الموقع. يعيد قائمة ما فشل */
export async function smoke(base = SITE, tries = 6) {
  let bad = []
  for (let i = 1; i <= tries; i++) {
    bad = []
    for (const p of SMOKE_PATHS) {
      try {
        const r = await fetch(base + p, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(15000) })
        const html = await r.text()
        if (r.status !== 200 || !BRAND.test(html)) bad.push(`${p} → ${r.status}`)
      } catch (e) {
        bad.push(`${p} → ${e instanceof Error ? e.message : e}`)
      }
    }
    if (!bad.length) return []
    if (i < tries) await new Promise((res) => setTimeout(res, 5000))
  }
  return bad
}

/** الدبابيس من الأحدث إلى الأقدم: {tag, date, commit, url, note} */
export function pins() {
  // الرسالة أسطر: الرابط، رابط المتابعة، الملاحظة — فالفاصل بين الوسوم NUL لا سطر
  const raw = git([
    'for-each-ref',
    '--sort=-taggerdate',
    '--format=%(refname:short)\t%(taggerdate:iso8601)\t%(*objectname:short)\t%(contents:subject)\t%(contents:body)%00',
    `refs/tags/${PIN_PREFIX}`,
  ])
  if (!raw) return []
  return raw
    .split('\0')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [tag, date, commit, url, body] = r.split('\t')
      const lines = (body || '').trim().split('\n')
      return { tag, date, commit, url, inspector: lines[0] || '', note: lines[1] || '' }
    })
}

export function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`
}

/** يدقّ دبّوساً: وسم موقّع على الالتزام برسالة (رابط النشر، رابط المتابعة، ملاحظة) ويدفعه */
export function pin(commit, url, inspector, note) {
  const tag = `${PIN_PREFIX}${stamp()}`
  git(['tag', '-a', tag, '-m', `${url}\n${inspector}\n${note}`, commit])
  try {
    git(['push', '-q', 'origin', tag], { stdio: 'ignore' })
  } catch {
    console.log(`  (لم يُدفع الوسم ${tag} إلى GitHub — ادفعه لاحقاً: git push origin ${tag})`)
  }
  return tag
}
