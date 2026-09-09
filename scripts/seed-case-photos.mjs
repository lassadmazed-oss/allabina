// ألبوم الحالات التجريبية: قبل · أثناء · بعد.
//
//   node scripts/seed-case-photos.mjs          ← يعمّر
//   node scripts/seed-case-photos.mjs --clean  ← يمحو
//
// الصور مولَّدة برمجياً، لا مستوردة. سببان:
//   1. صورة بيت إنسان آخر معروضة على أنّها إنجاز اللَّبنة كذبة على الزائر،
//      حتّى لو كانت النيّة عرض المنصّة.
//   2. حقوق الصور.
// الحالات التجريبية موسومة أصلاً بشارة «بيانات تجريبية» في الواجهة،
// والرسم التوضيحي يقول ما تقوله المرحلة: أرض وجدران واطئة، ثمّ هيكل
// وسقالات، ثمّ مسكن مكتمل.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { renderStages } from './lib/site-scenes.mjs'

const BUCKET = 'case-photos'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const CAPTIONS = {
  before: [
    { ar: 'الحالة كما وجدها الفريق', fr: "L'état constaté par l'équipe" },
    { ar: 'قبل التدخّل', fr: 'Avant intervention' },
    { ar: 'الوضع عند فتح الملفّ', fr: "À l'ouverture du dossier" },
  ],
  progress: [
    { ar: 'الهيكل وأشغال الخرسانة', fr: 'Structure et gros œuvre' },
    { ar: 'الأشغال جارية', fr: 'Travaux en cours' },
    { ar: 'مرحلة البناء', fr: 'Phase de construction' },
  ],
  after: [
    { ar: 'بعد الإنجاز والتسليم', fr: 'Après achèvement et livraison' },
    { ar: 'المسكن كما سُلّم', fr: 'Le logement livré' },
    { ar: 'النتيجة النهائية', fr: 'Résultat final' },
  ],
}

/** تاريخ اللقطة: قبل ← بداية المشروع · أثناء ← منتصفه · بعد ← تاريخ الإنجاز */
function takenAt(completedAt, durationMonths, stage) {
  if (!completedAt) return null
  const end = new Date(completedAt)
  const months = Number(durationMonths) || 6
  const back = stage === 'before' ? months : stage === 'progress' ? Math.round(months / 2) : 0
  const d = new Date(end)
  d.setMonth(d.getMonth() - back)
  return d.toISOString().slice(0, 10)
}

const storagePath = (caseId, stage, i) =>
  `${caseId}/${stage}/demo-${String(i).padStart(2, '0')}.png`

async function demoCases() {
  const { data, error } = await db
    .from('case_studies')
    .select('id, title_ar, completed_at, duration_months')
    .eq('is_demo', true)
    .order('completed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function clean() {
  const cases = await demoCases()
  if (!cases.length) return console.log('ما فمّاش حالات تجريبية.')

  const ids = cases.map((c) => c.id)
  const { data: rows } = await db.from('case_photos').select('storage_path').in('case_id', ids)
  const paths = (rows ?? []).map((r) => r.storage_path)

  if (paths.length) {
    const { error } = await db.storage.from(BUCKET).remove(paths)
    console.log(error ? `خطأ مخزن: ${error.message}` : `حُذفت ${paths.length} صورة من المخزن`)
  }
  const { error } = await db.from('case_photos').delete().in('case_id', ids)
  console.log(error ? `خطأ: ${error.message}` : 'حُذفت أسطر الصور')
}

async function seed() {
  const cases = await demoCases()
  if (!cases.length) return console.log('ما فمّاش حالات تجريبية. شغّل seed-demo.mjs أوّلاً.')

  let uploaded = 0
  for (const c of cases) {
    const { data: already } = await db
      .from('case_photos')
      .select('id')
      .eq('case_id', c.id)
      .limit(1)
    if (already?.length) {
      console.log(`— ${c.title_ar}: عندها صور، نتخطّاها`)
      continue
    }

    const stages = renderStages(c.id)
    let order = 0

    for (const { stage, png } of stages) {
      const path = storagePath(c.id, stage, order)
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, png, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true,
      })
      if (upErr) {
        console.error(`  رفع ${stage}: ${upErr.message}`)
        continue
      }

      const cap = CAPTIONS[stage][order % CAPTIONS[stage].length]
      const { error: rowErr } = await db.from('case_photos').insert({
        case_id: c.id,
        storage_path: path,
        stage,
        caption_ar: cap.ar,
        caption_fr: cap.fr,
        taken_at: takenAt(c.completed_at, c.duration_months, stage),
        sort_order: order,
        mime: 'image/png',
        bytes: png.length,
      })
      if (rowErr) console.error(`  سطر ${stage}: ${rowErr.message}`)
      else uploaded++
      order++
    }
    console.log(`✓ ${c.title_ar}`)
  }

  console.log(`\nتمّ: ${uploaded} صورة على ${cases.length} حالة.`)
  console.log('للمحو: node scripts/seed-case-photos.mjs --clean')
}

if (process.argv.includes('--clean')) await clean()
else await seed()
