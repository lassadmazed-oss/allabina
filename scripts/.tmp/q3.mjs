import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} })

for (const sel of [
  'id, category:intervenant_categories!category_id(name_ar, family_code), delegation:delegations!delegation_id(name_ar)',
  'id, intervenant_categories!intervenants_category_id_fkey(name_ar)',
]) {
  const r = await db.from('intervenants').select(sel)
  console.log(sel.slice(0, 60), '→', r.error?.message ?? JSON.stringify(r.data))
}
