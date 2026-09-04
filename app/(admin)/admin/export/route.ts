import { NextResponse } from 'next/server'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  const actor = await staffWithPermission('requests.export')
  if (!actor) {
    return new NextResponse('غير مصرّح', { status: 401 })
  }

  const { data: requests } = await db
    .from('housing_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: fins } = await db.from('financial_profiles').select('*')
  const { data: scores } = await db
    .from('scores')
    .select('request_id, total, band, max_budget_tnd, max_loan_tnd, computed_at')
    .order('computed_at', { ascending: false })

  const finBy = new Map((fins ?? []).map((f) => [f.request_id, f]))
  type ScoreRow = { request_id: string; total: number; band: string; max_budget_tnd: number; max_loan_tnd: number }
  const scoreBy = new Map<string, ScoreRow>()
  for (const s of scores ?? []) if (!scoreBy.has(s.request_id)) scoreBy.set(s.request_id, s)

  const header = [
    'الرمز', 'الاسم', 'الهاتف', 'البريد', 'الولاية', 'المعتمدية', 'نوع المطلب',
    'المساحة', 'الغرف', 'مستوى التشطيب', 'الأفق', 'الحالة', 'الدخل', 'دخل القرين', 'الأقساط الجارية',
    'التسبقة', 'النشاط', 'مقيم بالخارج', 'التنقيط', 'الصنف', 'القرض التقديري',
    'الميزانية', 'تاريخ التسجيل',
  ]

  const lines = [header.join(';')]
  for (const r of requests ?? []) {
    const f = finBy.get(r.id)
    const s = scoreBy.get(r.id)
    lines.push(
      [
        r.ref_code, r.full_name, r.phone, r.email, r.gov_code, r.delegation_id,
        r.request_type, r.desired_area_m2, r.bedrooms, r.standing, r.horizon, r.status,
        f?.monthly_income_tnd, f?.spouse_income_tnd, f?.existing_loans_tnd,
        f?.down_payment_tnd, f?.employment, f?.is_expat ? 'نعم' : 'لا',
        s?.total, s?.band, s?.max_loan_tnd, s?.max_budget_tnd, r.created_at,
      ]
        .map(esc)
        .join(';')
    )
  }

  // BOM حتى يفتح Excel العربية كما يجب
  const body = '﻿' + lines.join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="allabina-demandes-${date}.csv"`,
    },
  })
}
