/**
 * بيانات تجريبية لمنصّة اللَّبنة.
 *
 *   node scripts/seed-demo.mjs          ← يعمّر
 *   node scripts/seed-demo.mjs --clean  ← ينظّف كلّ شيء
 *
 * كلّ سطر يحمل is_demo = true، وكلّ حساب على نطاق @allabina.invalid
 * (نطاق محجوز لا يوجد ولا يستقبل بريداً). الواجهة العمومية تعرض بشارة
 * «بيانات تجريبية» على كلّ ما جاء من هنا، حتى ما يغلطش زائر.
 *
 * ⚠ الأسماء والقصص كلّها مخترعة. ما فمّا حتّى معطى شخص حقيقي.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

const N = 20
const DEMO_DOMAIN = 'allabina.invalid'
const clean = process.argv.includes('--clean')
const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0]

const client = new pg.Client({
  host: `aws-0-${process.env.SUPABASE_REGION ?? 'eu-central-1'}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${ref}`,
  password: env.DATABASE_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

// ---------- واجهة إدارة الحسابات ----------
const authHeaders = {
  apikey: env.SUPABASE_SECRET_KEY,
  authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  'content-type': 'application/json',
}

async function createAuthUser(email, fullName) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    // كلمة سرّ عشوائية لا تُطبع ولا تُحفظ: الحساب موجود للعرض لا للدخول
    body: JSON.stringify({
      email,
      password: `${randomUUID()}${randomUUID()}`,
      email_confirm: true,
      user_metadata: { full_name: fullName, demo: true },
    }),
  })
  if (!res.ok) throw new Error(`${email}: ${res.status} ${await res.text()}`)
  return (await res.json()).id
}

async function deleteDemoAuthUsers() {
  let removed = 0
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: authHeaders,
    })
    if (!res.ok) break
    const { users } = await res.json()
    if (!users?.length) break
    const demo = users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`))
    for (const u of demo) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      removed++
    }
    if (users.length < 200) break
  }
  return removed
}

// ---------- مفردات تونسية ----------
const FIRST_M = ['محمد', 'أحمد', 'سامي', 'نبيل', 'كريم', 'ياسين', 'وليد', 'حاتم', 'منير', 'عماد', 'رياض', 'طارق']
const FIRST_F = ['فاطمة', 'أميرة', 'سنية', 'ليلى', 'نجوى', 'إيمان', 'سلوى', 'هالة', 'رانية', 'وفاء']
const LAST = ['بن عمر', 'الطرابلسي', 'الشريف', 'بوعزيز', 'المصمودي', 'الكمّون', 'الغربي', 'بن سالم',
  'العبيدي', 'الجلاصي', 'المنصوري', 'بن حسين', 'الدريدي', 'الشعبوني', 'بوجلبان', 'الفقيه']

const JOBS = ['public', 'private', 'self_employed', 'informal', 'retired', 'expat']
const TYPES = ['build_on_land', 'land_and_house', 'apartment', 'economic', 'rent_to_own', 'renovation', 'other']
const STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment', 'contract', 'on_hold']
const URGENCY = ['planning', 'within_year', 'urgent', 'critical']
const FLEX = ['area', 'zone', 'standing', 'timing', 'type', 'budget']
const STANDINGS = ['B01', 'B02', 'B03', 'B04', 'B05']
const HORIZONS = ['now', '6m', '12m', '24m']
const TRACKS = ['ready', 'needs_property', 'needs_financing', 'needs_documents', 'needs_technical', 'social']

/** مولّد شبه عشوائي بجذر ثابت: نفس البذرة تعطي نفس البيانات */
let seed = 20260905
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const between = (a, b) => Math.floor(a + rnd() * (b - a + 1))
const phone = () => `${pick(['2', '5', '9'])}${between(1000000, 9999999)}`
const name = (i) => `${i % 3 === 0 ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()

const PARTNERS = [
  ['بنك الزيتونة — فرع صفاقس', 'bank'], ['البنك الوطني الفلاحي — صفاقس', 'bank'],
  ['شركة الإسكان الجنوبي للتنمية العقارية', 'developer'], ['المقاول العام للبناء بصفاقس', 'developer'],
  ['دار البناء للترقية العقارية', 'developer'],
  ['مقاولات بن عمر للبناء', 'contractor'], ['ورشة الحرفي للبناء والتلبيس', 'contractor'],
  ['مؤسسة الأمانة للأشغال', 'contractor'], ['فريق الجنوب للسقف والحدادة', 'contractor'],
  ['مصنع آجرّ صفاقس', 'supplier'], ['مخزن مواد البناء بقرمدة', 'supplier'],
  ['شركة الرخام والفرش بطينة', 'supplier'], ['ألمنيوم الجنوب', 'supplier'],
  ['بلدية صفاقس — مصلحة التراخيص', 'public'], ['وكالة التهذيب والتجديد العمراني', 'public'],
  ['جمعية التضامن للسكن اللائق', 'association'], ['جمعية أمل لمساندة العائلات', 'association'],
  ['مكتب دراسات المعمار الجنوبي', 'company'], ['مكتب الخبرة العقارية بصفاقس', 'company'],
  ['نقل ومناولة الصخيرة', 'other'],
]

const SUPPORT_CASES = [
  ['عائلة تحتاج سقف غرفتين', 'الجدران قائمة من سنتين والسقف ناقص. الأب حرفي بدخل غير قارّ، والتمويل البنكي ما كفاش.'],
  ['أرملة وثلاثة أطفال في سكن مؤقّت', 'العائلة تكري غرفة واحدة. عندها قطعة أرض ورثتها وما عندهاش قدرة على البناء.'],
  ['بيت بلا ربط بالماء الصالح للشراب', 'البناء مكتمل والربط بالشبكة يحتاج مصاريف تفوق قدرة العائلة.'],
  ['ترميم سقف يقطر على غرفة الأطفال', 'العزل قديم ومتضرّر. التدخّل مستعجل قبل الشتاء.'],
  ['أب مريض وبناء متوقّف منذ ثلاث سنوات', 'الهيكل قائم والتلبيس والتشطيب متوقّفان. الدخل انقطع بعد المرض.'],
  ['عائلة في بيت مهدّد بالانهيار', 'تقرير فنّي يوصي بإخلاء الجزء الخلفي. تحتاج حلّاً عاجلاً.'],
  ['شابّ معاق يحتاج تهيئة مدخل ودورة مياه', 'المسكن غير مهيّأ لكرسيّ متحرّك. التهيئة بسيطة والكلفة فوق الطاقة.'],
  ['بناء متوقّف عند مرحلة الأساسات', 'الأرض في ملكية العائلة والمخطّط جاهز. ينقص تمويل مرحلة الهيكل.'],
  ['عائلة تسكن مع الأقارب منذ خمس سنوات', 'تحتاج غرفتين مستقلّتين فوق البيت العائلي.'],
  ['سقف قصديري فوق غرفتين', 'الحرارة صيفاً والتسرّب شتاءً. تحتاج سقفاً خرسانياً.'],
  ['شبكة كهرباء غير مطابقة', 'التمديدات قديمة وخطرة. الربط الرسمي يستوجب تسويتها.'],
  ['مطبخ وحمّام بلا تجهيز', 'البيت مسكون والتجهيز الصحّي ناقص كلّياً.'],
  ['أرض عائلية غير مقسّمة', 'الورثة متّفقون والتقسيم يحتاج مصاريف مسّاح ووثائق.'],
  ['بناء بلا رخصة والعائلة تحبّ تسوّي وضعيتها', 'تحتاج مرافقة إدارية ودراسة فنّية للتسوية.'],
  ['عائلة تحتاج تكملة التلبيس الخارجي', 'الجدران مكشوفة والرطوبة تدخل. باقي التشطيب الخارجي.'],
  ['نافذتان وباب مفقودة منذ البناء', 'الفتحات مغلقة بالبلاستيك. تحتاج ألمنيوم وتركيب.'],
  ['بيت جدّة يحتاج ترميماً بسيطاً', 'تشقّقات وأرضية متضرّرة. تدخّل محدود يطيل عمر المسكن.'],
  ['عائلة نازحة من ولاية أخرى', 'تسكن بالكراء وتبحث عن حلّ قارّ في حدود قدرتها.'],
  ['صاحب أرض بلا طريق نفاذ', 'الأرض معزولة ويحتاج تهيئة مسلك للوصول قبل البناء.'],
  ['بناء توقّف بعد فقدان الشغل', 'المرحلة الأخيرة من التشطيب متوقّفة والعائلة تسكن فيه.'],
]

const NEEDS = [
  ['200 كيس إسمنت', 'materials'], ['حديد تسليح للسقف', 'materials'],
  ['آجرّ 20 لجدران خارجية', 'materials'], ['يد عاملة لصبّ السقف', 'labour'],
  ['بنّاء ليومين', 'labour'], ['دراسة هيكلية', 'study'],
  ['مخطّط معماري', 'study'], ['نقل مواد من المخزن', 'other'],
  ['مرافقة إدارية لملفّ الرخصة', 'admin_support'], ['تجهيز صحّي لحمّام', 'materials'],
]

const CASE_STUDIES = [
  ['دار 95 م² فوق أرض العائلة في عقارب', 'أرض عائلية وميزانية محدودة والحريف ما يعرفش من وين يبدا.',
   'قسّمنا المشروع مرحلتين: هيكل وتشطيب أساسي أوّلاً، وتشطيب كامل بعد سنة.', 'العائلة سكنت بعد أحد عشر شهراً.', 'build_on_land'],
  ['شقة 78 م² بصفاقس الشمالية', 'الميزانية ما تكفيش لدار مستقلّة والحريف يشتغل قرب المدينة.',
   'وجّهناه لشقة مطابقة لقدرته مع دراسة تمويل واضحة.', 'العقد أُمضي في ستّة أشهر.', 'apartment'],
  ['أرض وبناء في ساقية الزيت', 'الحريف يحبّ يشري أرض ويبني، وما عندوش صورة على الكلفة الكاملة.',
   'بوردرو مفصّل بيّن الكلفة الحقيقية، فبدّل المساحة من 140 إلى 110 م².', 'المشروع انطلق في حدود ميزانيته.', 'land_and_house'],
  ['ترميم دار قديمة في المدينة العتيقة', 'رطوبة وتشقّقات وسقف متضرّر.',
   'دراسة فنّية حدّدت الأولويات: العزل والسقف قبل الزينة.', 'الترميم تمّ على مرحلتين في سبعة أشهر.', 'renovation'],
  ['دار 120 م² في جبنيانة', 'الأرض بلا ربط بالماء والكهرباء.',
   'رتّبنا الربط مع الجهات المعنية قبل انطلاق الأشغال.', 'البناء انطلق بلا تعطيل.', 'build_on_land'],
  ['شقة اقتصادية للزوجين الشابّين', 'دخل متواضع وأوّل مسكن.',
   'وجّهناهم لبرنامج مناسب ورافقناهم في الملفّ.', 'تمّ الحصول على التمويل.', 'apartment'],
  ['توسعة غرفتين فوق البيت العائلي', 'العائلة كبرت والمساحة ما عادتش تكفي.',
   'دراسة تثبّتت من قدرة الهيكل على طابق إضافي.', 'التوسعة تمّت في خمسة أشهر.', 'renovation'],
  ['دار 105 م² في المحرس', 'الحريف مقيم بالخارج ويحتاج متابعة عن بُعد.',
   'تقارير مصوّرة أسبوعية ومتابعة مع المقاول.', 'المشروع سُلّم في الأجل.', 'build_on_land'],
  ['أرض 300 م² في الحنشة', 'الحريف يبحث عن أرض في حدود ميزانيته.',
   'ربطناه بمالك أرض مسجّل عندنا.', 'البيع تمّ مباشرةً بين الطرفين.', 'land_and_house'],
  ['دار 88 م² بتشطيب اقتصادي', 'الميزانية ضيّقة والحريف يحبّ يسكن بسرعة.',
   'مستوى B01 مع إمكانية ترقية التشطيب لاحقاً.', 'السكن تمّ في تسعة أشهر.', 'build_on_land'],
  ['تسوية وضعية بناء بلا رخصة', 'البناء قائم والوضعية الإدارية معلّقة.',
   'مرافقة إدارية ودراسة فنّية للتسوية.', 'الملفّ سُوّي في أربعة أشهر.', 'other'],
  ['شقة 92 م² بطريق تنيور', 'الحريف يحبّ منطقة قريبة من مدرسة الأولاد.',
   'بحث مركّز في المنطقة المطلوبة.', 'الشقة تمّ اقتناؤها في ثلاثة أشهر.', 'apartment'],
  ['دار 130 م² في ساقية الداير', 'المخطّط الأوّل يفوق الميزانية بثلاثين بالمائة.',
   'أعدنا توزيع المساحات وخفّضنا مستوى التشطيب درجة.', 'الكلفة رجعت في حدود القدرة.', 'build_on_land'],
  ['كراء مملّك لعائلة بدخل غير قارّ', 'التمويل البنكي التقليدي غير ممكن.',
   'حلّ كراء مملّك مع شريك عقاري.', 'العائلة دخلت المسكن.', 'other'],
  ['ترميم سقف وعزل في قرقنة', 'تسرّب مياه متكرّر شتاءً.',
   'عزل جديد مع تصحيح ميلان التصريف.', 'المشكل انحلّ نهائياً.', 'renovation'],
  ['دار 110 م² في منزل شاكر', 'الأرض بعيدة والمواد غالية بسبب النقل.',
   'اتّفاق مع مزوّد محلّي خفّض كلفة النقل.', 'وفّرنا نحو ثمانية بالمائة من كلفة المواد.', 'build_on_land'],
  ['شقة في مشروع قيد الإنجاز', 'الحريف يخاف من الشراء على المخطّط.',
   'تحقّقنا من وضعية المشروع ورافقناه في العقد.', 'الاقتناء تمّ بثقة.', 'apartment'],
  ['بناء على مرحلتين في العامرة', 'الميزانية ما تكفيش المشروع كامل.',
   'مرحلة أولى صالحة للسكن، وثانية بعد سنتين.', 'العائلة سكنت في المرحلة الأولى.', 'build_on_land'],
  ['أرض وبناء في بئر علي بن خليفة', 'الحريف يملك مدّخرات وما يعرفش يوظّفها.',
   'دراسة قدرة كاملة وخطّة على ثمانية عشر شهراً.', 'المشروع اكتمل في الأجل.', 'land_and_house'],
  ['دار 100 م² للمتقاعد', 'الدخل قارّ لكن محدود والعمر يقيّد مدّة التمويل.',
   'مساهمة ذاتية أكبر ومدّة أقصر.', 'الملفّ قُبل ومرّ البناء بلا تعطيل.', 'build_on_land'],
]

// ============================================================
async function main() {
  await client.connect()

  if (clean) {
    // الترتيب مقصود: المطالب أوّلاً لأنّ حذفها يجرّ حالات المساندة وقيود
    // الدفتر معها. لو حذفنا الشركاء قبلها، حاول المفتاح الخارجي أن يضع
    // partner_id = null في قيد قائم — وهذا تعديل يرفضه المُطلِق بحقّ:
    // اسم من ساهم جزء من السجلّ لا يُمحى منه.
    const tables = [
      'support_pledges', 'housing_requests', 'support_cases', 'case_studies',
      'properties', 'partners', 'citizen_profiles', 'staff',
    ]
    // حذف المطالب يجرّ وراءه قيود دفتر الشفافية، والمُطلِق يرفض الحذف
    // إلّا بفتح صريح — نفتحه داخل هذه المعاملة وحدها.
    await client.query('begin')
    await client.query("set local allabina.ledger_purge = 'on'")
    for (const t of tables) {
      const { rowCount } = await client.query(`delete from ${t} where is_demo`)
      if (rowCount) console.log(`  ${t}: ${rowCount}`)
    }
    await client.query('commit')
    const users = await deleteDemoAuthUsers()
    console.log(`  حسابات: ${users}`)
    console.log('\nتمّ التنظيف. ما بقاش أثر للبيانات التجريبية.')
    await client.end()
    return
  }

  const { rows: delegs } = await client.query(
    `select id from delegations where gov_code = 'SFX' order by id`
  )
  const delegIds = delegs.map((d) => d.id)
  if (!delegIds.length) throw new Error('لا توجد معتمديات — طبّق الهجرات أوّلاً')

  // ---------- فريق العمل ----------
  const ROLES = ['admin', 'admin', 'agent', 'agent', 'agent', 'agent', 'agent', 'agent',
    'agent', 'agent', 'agent', 'agent', 'agent', 'agent', 'viewer', 'viewer',
    'viewer', 'viewer', 'admin', 'agent']
  const staffIds = []
  for (let i = 0; i < N; i++) {
    const full = name(i)
    const email = `staff.${String(i + 1).padStart(2, '0')}@${DEMO_DOMAIN}`
    const id = await createAuthUser(email, full)
    await client.query(
      `insert into staff (user_id, full_name, email, role, active, must_change_password, is_demo)
       values ($1,$2,$3,$4,true,true,true) on conflict (user_id) do nothing`,
      [id, full, email, ROLES[i]]
    )
    staffIds.push(id)
  }
  console.log(`فريق العمل: ${staffIds.length}`)

  // ---------- مستعملو التطبيق ----------
  const citizenIds = []
  for (let i = 0; i < N; i++) {
    const full = name(i + 7)
    const email = `citizen.${String(i + 1).padStart(2, '0')}@${DEMO_DOMAIN}`
    const id = await createAuthUser(email, full)
    await client.query(
      `insert into citizen_profiles (user_id, full_name, phone, is_demo)
       values ($1,$2,$3,true) on conflict (user_id) do nothing`,
      [id, full, phone()]
    )
    citizenIds.push(id)
  }
  console.log(`مستعملون: ${citizenIds.length}`)

  // ---------- الشركاء ----------
  const partnerIds = []
  for (const [pname, kind] of PARTNERS) {
    const { rows } = await client.query(
      `insert into partners (name, kind, contact_name, phone, email, gov_code, is_active, is_demo)
       values ($1,$2,$3,$4,$5,'SFX',true,true) returning id`,
      [pname, kind, name(partnerIds.length), phone(),
       `contact.${partnerIds.length + 1}@${DEMO_DOMAIN}`]
    )
    partnerIds.push(rows[0].id)
  }
  console.log(`شركاء: ${partnerIds.length}`)

  // ---------- بائعو العقارات ----------
  const KINDS = ['land', 'house', 'apartment', 'building', 'land', 'house', 'apartment']
  const PROP_STATUS = ['approved', 'approved', 'approved', 'approved', 'pending', 'approved', 'reserved']
  for (let i = 0; i < N; i++) {
    const kind = KINDS[i % KINDS.length]
    const area = kind === 'land' ? between(200, 800) : between(80, 220)
    await client.query(
      `insert into properties
        (owner_name, owner_phone, owner_email, kind, gov_code, delegation_id, address,
         area_m2, built_area_m2, rooms, price_tnd, negotiable, legal_status, description,
         status, source, consent_at, created_at, is_demo)
       values ($1,$2,$3,$4,'SFX',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'demo',now(),$15,true)`,
      [
        name(i + 3), phone(), `owner.${i + 1}@${DEMO_DOMAIN}`, kind,
        delegIds[i % delegIds.length],
        pick(['قرمدة', 'الأفران', 'العين', 'طريق تنيور', 'شيحية', 'الحاجب', 'مرج الزهور', 'سكرة']),
        area, kind === 'land' ? null : between(70, 180), kind === 'land' ? null : between(2, 5),
        kind === 'land' ? area * between(90, 260) : between(140000, 460000),
        rnd() > 0.4, pick(['titled', 'in_progress', 'undivided', 'unregistered']),
        'عقار تجريبي لعرض المنصّة — المعطيات مخترعة.',
        PROP_STATUS[i % PROP_STATUS.length], daysAgo(between(1, 120)),
      ]
    )
  }
  console.log(`عقارات: ${N}`)

  // ---------- المطالب ----------
  const requestIds = []
  for (let i = 0; i < N; i++) {
    const type = TYPES[i % TYPES.length]
    const isBuild = type === 'build_on_land'
    const flex = [...new Set([pick(FLEX), pick(FLEX)])]
    const { rows } = await client.query(
      `insert into housing_requests
        (full_name, phone, email, gov_code, delegation_id, request_type, desired_area_m2,
         bedrooms, horizon, owns_land, status, standing, land_location, urgency, urgency_note,
         flexibility, problem_note, foprolos_interest, is_first_home, cnss_affiliated,
         cnss_number_years, study_track, consent_at, source, created_at, owner_user_id, is_demo)
       values ($1,$2,$3,'SFX',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::flexibility_kind[],$16,$17,$18,$19,$20,$21,
               now(),'demo',$22,$23,true)
       returning id`,
      [
        name(i), phone(), `citizen.${String(i + 1).padStart(2, '0')}@${DEMO_DOMAIN}`,
        delegIds[i % delegIds.length], type,
        between(80, 200), between(2, 5), pick(HORIZONS), isBuild,
        STATUSES[i % STATUSES.length], pick(STANDINGS),
        pick(['قرمدة', 'الأفران', 'العين', 'طريق المهدية', 'الشعبونة', 'بوعسيدة']),
        URGENCY[i % URGENCY.length],
        i % 4 === 3 ? 'إشعار بالخروج من الكراء' : null,
        flex, i % 3 === 0 ? 'نحبّ نبني على قدّ ميزانيتي وما نعرفش من وين نبدا.' : null,
        i % 5 === 0, i % 2 === 0, i % 3 !== 0, i % 3 !== 0 ? between(2, 20) : null,
        TRACKS[i % TRACKS.length], daysAgo(between(1, 180)), citizenIds[i],
      ]
    )
    const id = rows[0].id
    requestIds.push(id)

    const income = between(900, 4200)
    await client.query(
      `insert into financial_profiles
        (request_id, monthly_income_tnd, spouse_income_tnd, other_income_tnd, existing_loans_tnd,
         down_payment_tnd, employment, seniority_months, is_expat)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, income, rnd() > 0.5 ? between(0, 1800) : 0, rnd() > 0.7 ? between(0, 600) : 0,
       rnd() > 0.6 ? between(0, 700) : 0, between(0, 60000), pick(JOBS), between(12, 300),
       rnd() > 0.85]
    )
  }
  console.log(`مطالب: ${requestIds.length}`)

  // ---------- حالات تحتاج مساندة ----------
  for (let i = 0; i < N; i++) {
    const [title, summary] = SUPPORT_CASES[i]
    const { rows } = await client.query(
      `insert into support_cases
        (request_id, title_ar, summary_ar, gov_code, delegation_id,
         consent_given, consent_at, anonymised, published, created_at, is_demo)
       values ($1,$2,$3,'SFX',$4,true,now(),true,true,$5,true)
       on conflict (request_id) do nothing returning id`,
      [requestIds[i], title, summary, delegIds[i % delegIds.length], daysAgo(between(5, 150))]
    )
    if (!rows.length) continue

    const count = between(2, 4)
    const needIds = []
    for (let k = 0; k < count; k++) {
      const [label, kind] = NEEDS[(i + k) % NEEDS.length]
      const { rows: n } = await client.query(
        `insert into support_ledger (request_id, event, label, kind, occurred_at)
         values ($1,'needed',$2,$3, current_date - $4::int) returning id`,
        [requestIds[i], label, kind, between(10, 90)]
      )
      needIds.push(n[0].id)
    }
    // بعض الحاجيات تعهّد بها شريك، وبعضها وصل فعلاً
    if (rnd() > 0.2) {
      await client.query(
        `insert into support_ledger (request_id, event, label, kind, partner_id, partner_public, need_id, occurred_at)
         values ($1,'pledged',$2,'materials',$3,$4,$5, current_date - $6::int)`,
        [requestIds[i], `تعهّد بـ${NEEDS[i % NEEDS.length][0]}`, pick(partnerIds),
         rnd() > 0.5 ? PARTNERS[i % PARTNERS.length][0] : null, needIds[0], between(3, 40)]
      )
    }
    if (rnd() > 0.4) {
      await client.query(
        `insert into support_ledger
          (request_id, event, label, kind, partner_public, need_id, value_tnd, occurred_at)
         values ($1, 'delivered', $2, 'materials', $3, $4, $5, current_date - $6::int)`,
        [
          requestIds[i],
          `${NEEDS[(i + 1) % NEEDS.length][0]} — وصلت`,
          rnd() > 0.5 ? PARTNERS[(i + 3) % PARTNERS.length][0] : null,
          needIds[needIds.length - 1],
          between(400, 4000),
          between(1, 20),
        ]
      )
    }
  }
  console.log(`حالات مساندة: ${N}`)

  // ---------- الحالات المنجزة ----------
  for (let i = 0; i < N; i++) {
    const [title, problem, solution, result, kind] = CASE_STUDIES[i]
    await client.query(
      `insert into case_studies
        (title_ar, problem_ar, solution_ar, result_ar, kind, gov_code, delegation_id,
         area_m2, duration_months, completed_at, consent_given, consent_at, anonymised,
         published, created_at, is_demo)
       values ($1,$2,$3,$4,$5,'SFX',$6,$7,$8, current_date - $9::int, true, now(), true, true, $10, true)`,
      [title, problem, solution, result, kind, delegIds[i % delegIds.length],
       between(78, 150), between(4, 18), between(20, 500), daysAgo(between(30, 400))]
    )
  }
  console.log(`حالات منجزة: ${N}`)

  console.log('\nتمّ. كلّ سطر موسوم is_demo = true.')
  console.log('للتنظيف:  node scripts/seed-demo.mjs --clean')
  await client.end()
}

main().catch(async (e) => {
  console.error('\nفشل:', e.message)
  try { await client.end() } catch {}
  process.exit(1)
})
