// حالات العرض: أربع حالات منجزة وثلاث حالات مساندة بصور حقيقية المظهر.
//
//   node scripts/seed-showcase.mjs          ← يمحو الحالات التجريبية القديمة ويعمّر الجديدة
//   node scripts/seed-showcase.mjs --clean  ← يمحو الحالات التجريبية (والصور) فقط
//
// الصور في public/showcase/{cases,support}/<n>/ — مولَّدة بالذكاء الاصطناعي على
// هوية اللبنة، وكلّ سطر يبقى موسوماً is_demo = true: القصص مكتوبة لعرض
// المنصّة لا لحكاية أناس حقيقيين. حين تتوفّر حالات حقيقية بموافقة أصحابها
// تُدخل من لوحة القيادة وتحلّ محلّ هذه.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { connect, readEnv } from './lib/db.mjs'

const BUCKET = 'case-photos'
const env = readEnv()
const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
}).storage.from(BUCKET)

// ---------------------------------------------------------------- الحالات المنجزة
const CASES = [
  {
    dir: '1',
    kind: 'build_on_land',
    delegation: 'ساقية الزيت',
    area: 110,
    months: 9,
    completed: '2025-11-20',
    title_ar: 'دار عائلية 110 م² فوق أرض العائلة في ساقية الزيت',
    title_fr: 'Maison familiale de 110 m² sur le terrain familial à Sakiet Ezzit',
    problem_ar:
      'عائلة من أربعة أفراد تملك قطعة أرض ورثتها عن الجدّ، لكنّها كانت تكري شقّة صغيرة منذ ثماني سنوات: البنك رفض التمويل بلا مخطّط ولا تقدير كلفة واضح.',
    problem_fr:
      "Une famille de quatre personnes possédait un terrain hérité du grand-père, mais louait un petit appartement depuis huit ans : la banque refusait tout financement sans plan ni estimation claire des coûts.",
    solution_ar:
      'درس الفريق الأرض والوضعية المالية، واقترح نموذج 110 م² بمستوى تشطيب عادي، وأعدّ بوردرو بالكمّيات والأسعار. بالملفّ المرتّب حصلت العائلة على تمويل بنكي، وأُسند البناء لمقاول من شبكة اللبنة في المنطقة.',
    solution_fr:
      "L'équipe a étudié le terrain et la situation financière, proposé un modèle de 110 m² en finition standard et établi un bordereau quantitatif. Avec ce dossier, la famille a obtenu un crédit bancaire et la construction a été confiée à un entrepreneur du réseau AL-LUBNA.",
    result_ar:
      'تسليم الدار بعد تسعة أشهر، بكلفة نهائية أقلّ بـ4% من التقدير الأوّلي. العائلة سكنت دارها في نوفمبر 2025.',
    result_fr:
      "Maison livrée en neuf mois, avec un coût final inférieur de 4 % à l'estimation initiale. La famille a emménagé en novembre 2025.",
    captions: {
      before: [['الأرض كما وجدها الفريق: زياتين وجدار حجري واطئ', 'Le terrain tel que trouvé : oliviers et muret de pierre']],
      progress: [
        ['صبّ الأساسات', 'Coulage des fondations'],
        ['الهيكل والجدران بالآجرّ', 'Structure et murs en briques'],
        ['تسليح السقف قبل الصبّ', 'Ferraillage du toit avant coulage'],
      ],
      after: [
        ['الواجهة عند التسليم', 'La façade à la livraison'],
        ['غرفة الجلوس', 'Le séjour'],
        ['المطبخ', 'La cuisine'],
        ['الشرفة وشجرة الزيتون', 'La terrasse et son olivier'],
      ],
    },
  },
  {
    dir: '2',
    kind: 'apartment',
    delegation: 'صفاقس المدينة',
    area: 92,
    months: 14,
    completed: '2025-06-30',
    title_ar: 'شقة 92 م² لزوجين شابّين في مشروع قانوني بطريق تنيور',
    title_fr: "Appartement de 92 m² pour un jeune couple dans un projet légal, route de Teniour",
    problem_ar:
      'زوجان شابّان بدخلين متوسّطين وبلا تسبقة كبيرة، خافا من شراء شقة في مشروع بلا رخصة أو بلا ضمانات.',
    problem_fr:
      "Un jeune couple aux revenus moyens, sans apport important, craignait d'acheter un appartement dans un projet sans permis ni garanties.",
    solution_ar:
      'طابق الفريق مطلبهما مع مشروع قانوني قيد الإنجاز تحقّق من رخصه وعقوده، وحسب القسط الشهري الممكن على 25 سنة، ورافقهما في ملفّ التمويل حتى التوقيع.',
    solution_fr:
      "L'équipe a rapproché leur demande d'un projet légal en cours dont elle a vérifié permis et contrats, calculé la mensualité possible sur 25 ans et les a accompagnés jusqu'à la signature.",
    result_ar: 'استلام الشقة بعد 14 شهراً من التسجيل، بقسط شهري في حدود 35% من دخل الأسرة.',
    result_fr:
      "Appartement livré 14 mois après l'inscription, avec une mensualité limitée à 35 % du revenu du ménage.",
    captions: {
      before: [],
      progress: [['المشروع في طور الإنجاز', 'Le projet en cours de construction']],
      after: [
        ['الواجهة عند التسليم', 'La façade à la livraison'],
        ['غرفة الجلوس', 'Le séjour'],
        ['الشرفة', 'Le balcon'],
        ['الصالون', 'Le salon'],
        ['المطبخ', 'La cuisine'],
        ['غرفة النوم', 'La chambre'],
        ['المدخل', "L'entrée"],
      ],
    },
  },
  {
    dir: '3',
    kind: 'land_and_house',
    delegation: 'المحرس',
    area: 100,
    months: 11,
    completed: '2026-03-15',
    title_ar: 'أرض 250 م² ودار 100 م² بعقد واحد في المحرس',
    title_fr: 'Un terrain de 250 m² et une maison de 100 m² en un seul contrat, à Mahrès',
    problem_ar:
      'موظّف في القطاع الخاصّ يحبّ يبني في المحرس قرب عائلته، لكنّه ما عندوش أرض، والعروض اللي لقاها كانت أراضي بلا رسم عقاري واضح.',
    problem_fr:
      "Un salarié du privé souhaitait construire à Mahrès près de sa famille, mais n'avait pas de terrain, et les offres trouvées étaient des parcelles sans titre foncier clair.",
    solution_ar:
      'من عروض أصحاب العقارات المسجّلة عند اللبنة، اختير مقسم 250 م² برسم عقاري سليم، وأُعدّ عقد واحد يجمع الأرض والبناء بسعر معروف من البداية، لدار 100 م² بمستوى محسّن.',
    solution_fr:
      "Parmi les biens enregistrés par des propriétaires auprès d'AL-LUBNA, un lot de 250 m² avec titre foncier sain a été retenu ; un contrat unique terrain + construction, à prix connu dès le départ, a été établi pour une maison de 100 m² en finition améliorée.",
    result_ar: 'تسليم الدار مع حديقة صغيرة بعد 11 شهراً، من غير ما تتجاوز الكلفة الميزانية المحدّدة في الدراسة.',
    result_fr: "Maison livrée avec un petit jardin après 11 mois, sans dépasser le budget fixé dans l'étude.",
    captions: {
      before: [['المقسم عند التعاقد', 'Le lot à la signature']],
      progress: [
        ['الأساسات', 'Les fondations'],
        ['الجدران', 'Les murs'],
        ['السقف', 'Le toit'],
      ],
      after: [
        ['الدار عند التسليم', 'La maison à la livraison'],
        ['الحديقة', 'Le jardin'],
        ['غرفة الجلوس', 'Le séjour'],
        ['المطبخ', 'La cuisine'],
      ],
    },
  },
  {
    dir: '4',
    kind: 'renovation',
    delegation: 'صفاقس المدينة',
    area: 120,
    months: 6,
    completed: '2025-09-10',
    title_ar: 'ترميم دار عتيقة في المدينة وتوسعة غرفة للجدّة',
    title_fr: "Restauration d'une maison ancienne de la médina et extension d'une chambre pour la grand-mère",
    problem_ar:
      'دار عائلية قديمة في المدينة العتيقة: سقف يقطر على الصحن، رطوبة في الجدران، وغرفة ناقصة باش تسكن الجدّة مع أبنائها.',
    problem_fr:
      "Une vieille maison familiale de la médina : toit qui fuit sur le patio, murs humides, et une chambre manquante pour que la grand-mère vive avec ses enfants.",
    solution_ar:
      'دراسة فنّية للسقف والجدران، ترميم بمواد تحترم الطابع العتيق (جير وجبس وخشب)، وتوسعة غرفة 16 م² فوق الطابق الأرضي، بإشراف مهندس من شبكة اللبنة.',
    solution_fr:
      "Étude technique du toit et des murs, restauration avec des matériaux respectant le caractère ancien (chaux, plâtre, bois) et extension d'une chambre de 16 m² au-dessus du rez-de-chaussée, sous la supervision d'un ingénieur du réseau.",
    result_ar: 'انتهت الأشغال في ستة أشهر. الصحن رجع مكان اجتماع العائلة، والجدّة سكنت غرفتها الجديدة.',
    result_fr:
      "Travaux achevés en six mois. Le patio est redevenu le lieu de réunion de la famille, et la grand-mère a pris possession de sa nouvelle chambre.",
    captions: {
      before: [
        ['الصحن قبل الترميم', 'Le patio avant restauration'],
        ['أثر التسرّب في السقف', "Traces d'infiltration au plafond"],
      ],
      progress: [
        ['ترميم السقف', 'Restauration du toit'],
        ['بناء غرفة التوسعة', "Construction de la chambre d'extension"],
      ],
      after: [
        ['الصحن بعد الترميم', 'Le patio restauré'],
        ['غرفة الجدّة', 'La chambre de la grand-mère'],
        ['الواجهة', 'La façade'],
        ['السطح', 'La terrasse du toit'],
      ],
    },
  },
]

// ---------------------------------------------------------------- حالات المساندة
const SUPPORT = [
  {
    dir: '1',
    delegation: 'الحنشة',
    title_ar: 'عائلة تحتاج سقفاً لغرفتين في الحنشة',
    title_fr: "Une famille a besoin d'un toit pour deux pièces à El Hencha",
    summary_ar:
      'الجدران قائمة من سنتين والسقف ناقص. الأب حرفي بدخل غير قارّ، والتمويل البنكي ما كفاش. الحاجة: حديد تسليح وإسمنت ويد عاملة لصبّ السقف.',
    summary_fr:
      "Les murs sont debout depuis deux ans, le toit manque. Le père est artisan au revenu irrégulier et le crédit bancaire n'a pas suffi. Besoin : fer à béton, ciment et main-d'œuvre pour couler la dalle.",
    needs: [
      ['حديد تسليح للسقف', 'materials', 62],
      ['120 كيس إسمنت', 'materials', 58],
      ['يد عاملة لصبّ السقف', 'labour', 40],
    ],
    pledged: [1, 'مخزن مواد البناء بقرمدة', 21],
    delivered: [0, null, 9],
    captions: [
      ['الغرفتان بلا سقف', 'Les deux pièces sans toit'],
      ['الجدران من الداخل', "Les murs vus de l'intérieur"],
      ['فناء العائلة', 'La cour de la famille'],
      ['الحديد المطلوب للسقف', 'Le fer à béton nécessaire'],
    ],
  },
  {
    dir: '2',
    delegation: 'جبنيانة',
    title_ar: 'بناء متوقّف عند الهيكل منذ ثلاث سنوات في جبنيانة',
    title_fr: 'Une construction arrêtée au stade du gros œuvre depuis trois ans à Jebiniana',
    summary_ar:
      'الهيكل الخرساني قائم والأشغال متوقّفة بعد مرض الأب وانقطاع الدخل. العائلة تسكن بالكراء. الحاجة: آجرّ للجدران، يد عاملة، وألمنيوم للفتحات.',
    summary_fr:
      "La structure en béton est debout mais les travaux sont arrêtés depuis la maladie du père et la perte de revenu. La famille loue. Besoin : briques, main-d'œuvre et menuiserie aluminium.",
    needs: [
      ['آجرّ 12 لجدران الطابق الأرضي', 'materials', 75],
      ['يد عاملة للبناء والتلبيس', 'labour', 70],
      ['ألمنيوم لثلاث نوافذ وباب', 'materials', 33],
    ],
    pledged: [2, 'ألمنيوم الجنوب', 12],
    delivered: null,
    captions: [
      ['الهيكل كما هو اليوم', "La structure telle qu'elle est aujourd'hui"],
      ['الأعمدة من الداخل', "Les poteaux vus de l'intérieur"],
      ['الموقع من الطريق', 'Le site depuis la route'],
      ['ما تبقّى من مواد', 'Les matériaux restants'],
    ],
  },
  {
    dir: '3',
    delegation: 'قرقنة',
    title_ar: 'ترميم سقف يقطر على غرفة الأطفال في قرقنة',
    title_fr: "Réparer un toit qui fuit sur la chambre des enfants à Kerkennah",
    summary_ar:
      'دار قديمة في قرقنة، العزل متضرّر والماء يدخل غرفة الأطفال كلّ شتاء. تحتاج عزلاً وترميماً للسقف قبل الأمطار.',
    summary_fr:
      "Une vieille maison à Kerkennah : l'étanchéité est abîmée et l'eau entre chaque hiver dans la chambre des enfants. Besoin d'étanchéité et de réparation du toit avant les pluies.",
    needs: [
      ['مواد عزل للسقف (40 م²)', 'materials', 45],
      ['بنّاء ليومين', 'labour', 44],
      ['نقل المواد من صفاقس إلى قرقنة', 'other', 30],
    ],
    pledged: [0, null, 14],
    delivered: [2, 'نقل ومناولة الصخيرة', 6],
    captions: [
      ['السقف المتضرّر', 'Le toit abîmé'],
      ['أثر الماء في غرفة الأطفال', "Traces d'eau dans la chambre des enfants"],
      ['الدار من الخارج', "La maison vue de l'extérieur"],
      ['سطح الدار', 'La terrasse du toit'],
    ],
  },
]

// ---------------------------------------------------------------- أدوات
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const monthsBefore = (iso, n) => {
  const d = new Date(iso)
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}
const listPhotos = (dir, prefix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && /\.(jpe?g|png|webp)$/i.test(f))
        .sort()
    : []

async function upload(path, file) {
  const buf = readFileSync(file)
  const mime = file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  const { error } = await storage.upload(path, buf, { contentType: mime, cacheControl: '31536000', upsert: true })
  if (error) throw new Error(`رفع ${path}: ${error.message}`)
  return { mime, bytes: buf.length }
}

async function removeStorage(paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await storage.remove(paths.slice(i, i + 100))
    if (error) console.warn('  مخزن:', error.message)
  }
}

// ---------------------------------------------------------------- محو
async function clean(client) {
  const { rows: casePhotos } = await client.query(
    `select p.storage_path from case_photos p join case_studies c on c.id = p.case_id where c.is_demo`
  )
  const { rows: supPhotos } = await client.query(
    `select p.storage_path from support_photos p join support_cases s on s.id = p.support_case_id where s.is_demo`
  )
  await removeStorage([...casePhotos, ...supPhotos].map((r) => r.storage_path))

  const a = await client.query(`delete from case_studies where is_demo`)
  // دفتر الشفافية سجلّ إضافي: الحذف لا يمرّ إلّا بفتح allabina.ledger_purge داخل معاملة (0018)
  await client.query('begin')
  await client.query(`set local allabina.ledger_purge = 'on'`)
  const b = await client.query(
    `delete from support_ledger where request_id in (select request_id from support_cases where is_demo)`
  )
  await client.query('commit')
  const c = await client.query(`delete from support_cases where is_demo`)
  console.log(`محو: ${a.rowCount} حالة منجزة · ${c.rowCount} حالة مساندة · ${b.rowCount} قيد دفتر`)
}

// ---------------------------------------------------------------- تعمير
async function seed(client) {
  const { rows: delegs } = await client.query(
    `select id, name_ar from delegations where gov_code = 'SFX'`
  )
  const delegId = (name) => {
    const d = delegs.find((x) => x.name_ar === name)
    if (!d) throw new Error(`معتمدية غير معروفة: ${name}`)
    return d.id
  }

  // الحالات المنجزة
  let photosTotal = 0
  for (const c of CASES) {
    const { rows } = await client.query(
      `insert into case_studies
        (title_ar, title_fr, problem_ar, problem_fr, solution_ar, solution_fr, result_ar, result_fr,
         kind, gov_code, delegation_id, area_m2, duration_months, completed_at,
         consent_given, consent_at, anonymised, published, created_at, is_demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SFX',$10,$11,$12,$13,true,now(),true,true,$14,true)
       returning id`,
      [
        c.title_ar, c.title_fr, c.problem_ar, c.problem_fr, c.solution_ar, c.solution_fr,
        c.result_ar, c.result_fr, c.kind, delegId(c.delegation), c.area, c.months, c.completed,
        c.completed,
      ]
    )
    const id = rows[0].id
    const dir = join('public/showcase/cases', c.dir)
    let order = 0
    for (const stage of ['before', 'progress', 'after']) {
      const files = listPhotos(dir, `${stage}-`)
      for (let i = 0; i < files.length; i++) {
        const path = `${id}/${stage}/showcase-${String(order).padStart(2, '0')}.jpg`
        const { mime, bytes } = await upload(path, join(dir, files[i]))
        const cap = c.captions[stage][i] ?? [null, null]
        const back = stage === 'before' ? c.months : stage === 'progress' ? Math.round(c.months / 2) : 0
        await client.query(
          `insert into case_photos (case_id, storage_path, stage, caption_ar, caption_fr, taken_at, sort_order, mime, bytes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, path, stage, cap[0], cap[1], monthsBefore(c.completed, back), order, mime, bytes]
        )
        order++
        photosTotal++
      }
    }
    console.log(`✓ حالة منجزة: ${c.title_ar} (${order} صورة)`)
  }

  // حالات المساندة — تُربط بمطالب تجريبية موجودة (الحاجة لا الشخص)
  const { rows: reqs } = await client.query(
    `select id from housing_requests
      where is_demo and id not in (select request_id from support_cases)
      order by created_at limit $1`,
    [SUPPORT.length]
  )
  if (reqs.length < SUPPORT.length) throw new Error('ما فمّاش مطالب تجريبية كافية. شغّل seed-demo.mjs أوّلاً.')

  for (let i = 0; i < SUPPORT.length; i++) {
    const s = SUPPORT[i]
    const requestId = reqs[i].id
    await client.query(`update housing_requests set delegation_id = $1 where id = $2`, [delegId(s.delegation), requestId])
    const { rows } = await client.query(
      `insert into support_cases
        (request_id, title_ar, title_fr, summary_ar, summary_fr, gov_code, delegation_id,
         consent_given, consent_at, anonymised, published, created_at, is_demo)
       values ($1,$2,$3,$4,$5,'SFX',$6,true,now(),true,true,$7,true)
       returning id`,
      [requestId, s.title_ar, s.title_fr, s.summary_ar, s.summary_fr, delegId(s.delegation), daysAgo(80 - i * 15)]
    )
    const id = rows[0].id

    const needIds = []
    for (const [label, kind, ago] of s.needs) {
      const { rows: n } = await client.query(
        `insert into support_ledger (request_id, event, label, kind, occurred_at)
         values ($1,'needed',$2,$3,$4) returning id`,
        [requestId, label, kind, daysAgo(ago)]
      )
      needIds.push(n[0].id)
    }
    if (s.pledged) {
      const [idx, partner, ago] = s.pledged
      await client.query(
        `insert into support_ledger (request_id, event, label, kind, partner_public, need_id, occurred_at)
         values ($1,'pledged',$2,$3,$4,$5,$6)`,
        [requestId, `تعهّد بـ${s.needs[idx][0]}`, s.needs[idx][1], partner, needIds[idx], daysAgo(ago)]
      )
    }
    if (s.delivered) {
      const [idx, partner, ago] = s.delivered
      await client.query(
        `insert into support_ledger (request_id, event, label, kind, partner_public, need_id, occurred_at)
         values ($1,'delivered',$2,$3,$4,$5,$6)`,
        [requestId, `${s.needs[idx][0]} — وصلت`, s.needs[idx][1], partner, needIds[idx], daysAgo(ago)]
      )
    }

    const dir = join('public/showcase/support', s.dir)
    const files = listPhotos(dir, '')
    for (let k = 0; k < files.length; k++) {
      const path = `support/${id}/showcase-${String(k).padStart(2, '0')}.jpg`
      const { mime, bytes } = await upload(path, join(dir, files[k]))
      const cap = s.captions[k] ?? [null, null]
      await client.query(
        `insert into support_photos (support_case_id, storage_path, caption_ar, caption_fr, sort_order, mime, bytes)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, path, cap[0], cap[1], k, mime, bytes]
      )
      photosTotal++
    }
    console.log(`✓ حالة مساندة: ${s.title_ar} (${files.length} صورة)`)
  }

  console.log(`\nتمّ: ${CASES.length} حالة منجزة، ${SUPPORT.length} حالة مساندة، ${photosTotal} صورة.`)
}

const client = await connect()
try {
  await clean(client)
  if (!process.argv.includes('--clean')) await seed(client)
} finally {
  await client.end()
}
