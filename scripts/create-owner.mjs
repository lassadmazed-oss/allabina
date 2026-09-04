// إنشاء (أو ترقية) حساب مالك للوحة القيادة.
// الاستعمال:  node scripts/create-owner.mjs allabina@gmail.com
//
// كلمة السرّ تُطلب تفاعلياً ولا تظهر على الشاشة، ولا تُمرَّر في سطر الأوامر
// حتى لا تُحفظ في تاريخ الطرفية.
import { readFileSync } from 'node:fs'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('الاستعمال: node scripts/create-owner.mjs <email>')
  process.exit(1)
}

const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const secret = env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('SUPABASE_URL أو SUPABASE_SECRET_KEY غير معرّفين في .env')
  process.exit(1)
}

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    rl._writeToOutput = (s) => {
      if (s.includes(query)) rl.output.write(query)
    }
    rl.question(query, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

/** خارج الطرفية التفاعلية (أنبوب أو CI): السطر الأوّل من stdin هو كلمة السرّ. */
async function readPiped() {
  let buf = ''
  for await (const chunk of process.stdin) buf += chunk
  return buf.split(/\r?\n/)[0].trim()
}

const interactive = Boolean(process.stdin.isTTY)
const password = interactive
  ? await askHidden(`كلمة السرّ لـ ${email}: `)
  : await readPiped()
if (password.length < 8) {
  console.error('كلمة السرّ: 8 أحرف على الأقلّ.')
  process.exit(1)
}
if (interactive) {
  const again = await askHidden('أعد كتابتها للتأكيد: ')
  if (again !== password) {
    console.error('الكلمتان غير متطابقتين.')
    process.exit(1)
  }
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUser(mail) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === mail)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

let user = await findUser(email)
let created = false

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  })
  if (error) {
    console.error('تعذّر تحديث كلمة السرّ:', error.message)
    process.exit(1)
  }
  console.log('الحساب موجود — حُدِّثت كلمة السرّ.')
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.error('تعذّر إنشاء الحساب:', error.message)
    process.exit(1)
  }
  user = data.user
  created = true
  console.log('أُنشئ الحساب في Supabase Auth.')
}

const { error: staffError } = await admin.from('staff').upsert(
  {
    user_id: user.id,
    email,
    full_name: env.OWNER_NAME || 'المالك',
    role: 'owner',
    active: true,
    must_change_password: false,
  },
  { onConflict: 'user_id' }
)

if (staffError) {
  console.error('تعذّر إدراج العضو في جدول staff:', staffError.message)
  process.exit(1)
}

await admin.from('staff_events').insert({
  event_type: created ? 'member_created' : 'password_set',
  actor: user.id,
  actor_email: email,
  target: user.id,
  target_email: email,
  detail: { role: 'owner', via: 'scripts/create-owner.mjs' },
})

console.log(`\nتمّ. ${email} أصبح مالكاً للوحة القيادة.`)
console.log('الدخول من: http://localhost:3100/admin/login')
