import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} })

const { data: rows } = await db.from('intervenants')
  .select('id, full_name, phone, status, legal_status, years_experience, radius_km, availability, source, intervenant_categories(name_ar), delegations(name_ar)')
console.log('intervenants:', JSON.stringify(rows, null, 1))

const id = rows?.[0]?.id
if (id) {
  const { data: sk } = await db.from('intervenant_skills').select('skills(name_ar)').eq('intervenant_id', id)
  console.log('المهارات:', sk?.map(s => s.skills?.name_ar))
  const { data: zn } = await db.from('intervenant_zones').select('delegations(name_ar)').eq('intervenant_id', id)
  console.log('مناطق التدخّل:', zn?.map(z => z.delegations?.name_ar))
  const { data: ev } = await db.from('intervenant_events').select('event_type, to_status, note').eq('intervenant_id', id)
  console.log('سجلّ الأثر:', ev)
}
