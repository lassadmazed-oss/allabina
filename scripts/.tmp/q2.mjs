import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} })

let r = await db.from('intervenants').select('id, full_name, phone, status')
console.log('plain :', r.error?.message ?? r.data)

r = await db.from('intervenants').select('id, intervenant_categories(name_ar)')
console.log('nested cat :', r.error?.message ?? JSON.stringify(r.data))

r = await db.from('intervenants').select('id, delegations(name_ar)')
console.log('nested deleg:', r.error?.message ?? JSON.stringify(r.data))
