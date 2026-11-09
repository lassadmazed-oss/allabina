import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * العروض تتجاوز RLS — حرس على الثقب بعد سدّه.
 *
 * العرض في Postgres يُقرأ بصلاحيات مُنشئه، فسياسات RLS على الجدول الأمّ
 * لا تشتغل. هذا تسريب صامت: ما ثمّ خطأ ولا سجلّ، فقط معطيات مقروءة
 * بالمفتاح العمومي الذي يُرسَل لمتصفّح كلّ زائر. وُجد يوم 2026-11-09 على
 * خمسة عروض، منها واحد يحمل هواتف عائلات في وضع هشّ.
 *
 * فالاختبار يسأل سؤالاً واحداً: كلّ عرض في الهجرات — هل هو في قائمة
 * «عمومي بنيّة» أم في قائمة المحميّين في 0053؟ عرضٌ جديد لا في هذه ولا
 * في تلك يُسقِط الاختبار، فيلزم صاحبه يقرّر أين يضعه قبل ما يُدمج.
 */
const DIR = 'supabase/migrations'
const HARDENING = '0053_view_privacy.sql'

/** أعداد مجرّدة بلا معطى شخصي — أساس الصفحات العمومية، تبقى مقروءة */
const PUBLIC_BY_DESIGN = ['public_request_stats', 'delegation_activity', 'support_case_public']

function allViews(): string[] {
  const names = new Set<string>()
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(DIR, f), 'utf8')
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([a-z0-9_]+)/gi)) {
      names.add(m[1].toLowerCase())
    }
  }
  return [...names].sort()
}

const hardened = readFileSync(join(DIR, HARDENING), 'utf8')

describe('خصوصية العروض', () => {
  it('ما ثمّ عرض بلا قرار: إمّا عمومي بنيّة وإمّا محميّ', () => {
    const undecided = allViews().filter(
      (v) => !PUBLIC_BY_DESIGN.includes(v) && !hardened.includes(`'${v}'`)
    )
    expect(undecided, `عروض بلا قرار — زِدها في PUBLIC_BY_DESIGN أو في ${HARDENING}`).toEqual([])
  })

  it('الهجرة تمنع anon وتُشغّل security_invoker — الطبقتان لا واحدة', () => {
    expect(hardened).toContain('security_invoker = on')
    expect(hardened).toMatch(/revoke all on %I from anon/)
  })

  it('العروض الحاملة لمعطى شخصي محميّة بالاسم', () => {
    for (const v of ['request_priority', 'request_document_status', 'support_inbox']) {
      expect(hardened, `${v} يحمل أسماء أو هواتف`).toContain(`'${v}'`)
    }
  })

  it('العروض العمومية ما تدخلش قائمة المنع — الصفحات العمومية تحتاجها', () => {
    for (const v of PUBLIC_BY_DESIGN) {
      expect(hardened.includes(`'${v}'`), `${v} عمومي بنيّة`).toBe(false)
    }
  })
})
