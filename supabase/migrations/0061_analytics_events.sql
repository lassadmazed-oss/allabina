-- ============================================================
-- قياس الطلب الحقيقي: أحداث مُعرَّفة، بلا معطى شخصي
-- ============================================================
-- كرّاس الشروط V2، القسم 09: «الأحداث: تصفح صنف، بدء تجربة، طلب حساب،
-- حساب مثبت، مشروع محفوظ، تقدير، طلب مراجعة، معاينة، devis معتمد،
-- قبول، عقد»، و«فصل أشخاص فريدين عن عدد نسخ التقدير»، و**«التحليلات
-- الخارجية لا تستقبل أسماء أو أرقام أو دخل أو وثائق»**.
--
-- الشرط الأخير مطبَّق بنيةً لا سياسةً: الجدول **لا يملك** عموداً
-- للاسم ولا للهاتف ولا للدخل. ما لا يوجد لا يتسرّب، ولا ينتظر انضباط
-- من يكتب الاستعلام بعد سنتين.
--
-- ولا مزوّد خارجي: الأحداث تُكتب هنا، في قاعدتنا، ولا تغادرها.

create table if not exists analytics_events (
  id            bigserial primary key,
  -- من القائمة في الكرّاس حرفياً — قيدٌ لا تعليق
  event         text not null check (event in (
                  'category_view',      -- تصفّح صنف
                  'trial_start',         -- بدء تجربة
                  'account_requested',   -- طلب حساب
                  'account_verified',    -- حساب مثبَّت
                  'project_saved',       -- مشروع محفوظ
                  'estimate',            -- تقدير
                  'review_requested',    -- طلب مراجعة
                  'inspection',          -- معاينة
                  'devis_approved',      -- devis معتمد
                  'accepted',            -- قبول
                  'contract'             -- عقد
                )),
  occurred_at   timestamptz not null default now(),

  -- الزائر: معرّف عشوائي من كوكي. ليس هويّة ولا يُربط باسم.
  visitor_id    uuid,
  -- الحساب إن وُجد — للتمييز بين شخص وشخص لا لمعرفة من هو
  user_id       uuid references app_users (id) on delete set null,
  request_id    uuid references housing_requests (id) on delete set null,

  -- الأبعاد التي تطلبها اللوحة: «المنطقة ونوع المشروع والمساحة ونطاق
  -- الميزانية والتشطيب والجاهزية». كلّها فئات لا قيَماً خامّة.
  gov_code      text,
  delegation_id integer references delegations (id) on delete set null,
  project_type  text,
  area_bucket   text,
  budget_bucket text,
  standing      text,
  readiness     text,

  -- سياق إضافي بلا معطى شخصي: رمز لوط، مرجع مقال، رقم نسخة…
  meta          jsonb
);

comment on table analytics_events is
  'قياس الطلب — أحداث مُعرَّفة بلا اسم ولا هاتف ولا دخل. القيد على event هو تعريفها.';
comment on column analytics_events.visitor_id is
  'معرّف كوكي عشوائي لفصل الأشخاص عن عدد النسخ. ليس هويّة ولا يُربط باسم.';
comment on column analytics_events.area_bucket is
  'فئة مساحة لا مساحة: «120-160». القيمة الخامّة تعرّف الملفّ، والفئة تكفي للقياس.';

create index if not exists analytics_events_time_idx on analytics_events (occurred_at desc);
create index if not exists analytics_events_event_idx on analytics_events (event, occurred_at desc);
create index if not exists analytics_events_visitor_idx on analytics_events (visitor_id);

alter table analytics_events enable row level security;
revoke all on analytics_events from anon, authenticated;

-- حارسٌ على النيّة: عمود باسم شخصي لا يُضاف لاحقاً بالسهو.
-- (قيدٌ على البنية لا يمكن كتابته في Postgres، فالحارس اختبارٌ في
--  tests/analytics.test.ts يقرأ هذه الهجرة ويرفض الأسماء الممنوعة.)
