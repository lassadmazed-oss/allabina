-- ============================================================
-- 0016_demo_flag.sql · وسم البيانات التجريبية
-- ============================================================
-- المنصة تحتاج بيانات باش يشوفها الفريق ويجرّب عليها. المشكل إنّ
-- «حالات تحتاج مساندة» و«الحالات المنجزة» صفحات عمومية: حالة إنسان
-- مخترعة معروضة بلا وسم هي كذبة على الزائر، حتّى لو كانت النيّة تجربة.
--
-- الحلّ: وسم في القاعدة، لا في اتّفاق شفوي.
--   · كلّ سطر تجريبي يحمل is_demo = true
--   · الواجهة العمومية تعرضه بشارة «بيانات تجريبية» ظاهرة
--   · التنظيف قبل الإطلاق أمر واحد: node scripts/seed-demo.mjs --clean
--
-- الافتراض false: أيّ سطر يدخل من الاستمارة حقيقي حتى يُقال غير ذلك.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'housing_requests', 'properties', 'partners', 'case_studies',
    'support_cases', 'support_pledges', 'staff', 'citizen_profiles'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'alter table %I add column if not exists is_demo boolean not null default false', t
      );
      execute format(
        'create index if not exists %I on %I (is_demo) where is_demo', t || '_demo_idx', t
      );
      execute format(
        'comment on column %I.is_demo is %L',
        t, 'سطر تجريبي — يُعرض بشارة في الواجهة ويُحذف بأمر واحد قبل الإطلاق'
      );
    end if;
  end loop;
end $$;

-- العرض العمومي لحالات المساندة يحمل الوسم حتى تعرضه الصفحة.
-- يُسقَط أوّلاً: هجرة 0012 تعيد إنشاءه بأعمدته القديمة عند كلّ تطبيق،
-- و create or replace ما ينجّمش يزيد عموداً على عرض قائم بلا إسقاط.
drop view if exists support_case_public;
create view support_case_public as
select
  c.id,
  c.title_ar, c.title_fr, c.summary_ar, c.summary_fr,
  c.gov_code, c.delegation_id, c.created_at,
  count(l.id) filter (where l.event = 'needed')::int    as needs_count,
  count(l.id) filter (where l.event = 'delivered')::int as delivered_count,
  count(l.id) filter (where l.event in ('pledged','confirmed'))::int as pledged_count,
  count(distinct l.need_id) filter (where l.event = 'delivered')::int as covered_needs,
  c.is_demo
from support_cases c
left join support_ledger l on l.request_id = c.request_id
where c.published and c.closed_at is null
group by c.id;

-- إحصائيات المتابعة العمومية تستثني التجريبي: عدّاد يعدّ ملفّات وهمية
-- يعطي انطباعاً غالطاً عن حجم العمل الحقيقي.
create or replace view public_request_stats as
select
  count(*)::int                                                              as received,
  count(*) filter (where status in ('matched','contract'))::int              as resolved,
  count(*) filter (where status in ('new','contacted','qualified','appointment'))::int as in_progress,
  count(*) filter (where status = 'on_hold')::int                            as waiting,
  count(*) filter (where status = 'rejected')::int                           as closed,
  max(updated_at)                                                            as last_activity_at
from housing_requests
where not is_demo;
