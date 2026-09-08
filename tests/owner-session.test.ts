import { beforeAll, describe, expect, it } from 'vitest'

process.env.SUPABASE_SECRET_KEY = 'clef-de-test-uniquement'

let issueOwnerToken: typeof import('@/lib/owner-session')['issueOwnerToken']
let readOwnerToken: typeof import('@/lib/owner-session')['readOwnerToken']

beforeAll(async () => {
  const mod = await import('@/lib/owner-session')
  issueOwnerToken = mod.issueOwnerToken
  readOwnerToken = mod.readOwnerToken
})

const ID = '5a7558ac-e389-4da9-8bcb-d60ff64c4767'

describe('رمز جلسة صاحب المطلب', () => {
  it('يرجع المعرّف الذي وُقّع عليه', () => {
    expect(readOwnerToken(issueOwnerToken(ID))).toBe(ID)
  })

  it('يرفض رمزاً غائباً أو مشوّهاً', () => {
    expect(readOwnerToken(undefined)).toBeNull()
    expect(readOwnerToken('')).toBeNull()
    expect(readOwnerToken('abc')).toBeNull()
    expect(readOwnerToken(`${ID}.9999999999999`)).toBeNull()
  })

  it('يرفض معرّفاً بُدّل بعد التوقيع', () => {
    const t = issueOwnerToken(ID)
    const other = '11111111-2222-3333-4444-555555555555'
    const [, exp, mac] = t.split('.')
    expect(readOwnerToken(`${other}.${exp}.${mac}`)).toBeNull()
  })

  it('يرفض تمديد المدّة بلا توقيع جديد', () => {
    const t = issueOwnerToken(ID)
    const [id, , mac] = t.split('.')
    expect(readOwnerToken(`${id}.${Date.now() + 10 ** 9}.${mac}`)).toBeNull()
  })

  it('يرفض توقيعاً بطول مختلف بلا أن يرمي', () => {
    const [id, exp] = issueOwnerToken(ID).split('.')
    expect(readOwnerToken(`${id}.${exp}.x`)).toBeNull()
  })

  it('ينتهي بعد نصف ساعة', () => {
    const t = issueOwnerToken(ID, 0)
    expect(readOwnerToken(t, 29 * 60 * 1000)).toBe(ID)
    expect(readOwnerToken(t, 31 * 60 * 1000)).toBeNull()
  })

  it('لا يقبل معرّفاً ليس UUID حتى لو صحّ التوقيع', () => {
    // شكل المعرّف جزء من الشرط: التوقيع وحده لا يكفي
    expect(readOwnerToken(issueOwnerToken('../../etc/passwd'))).toBeNull()
  })
})
