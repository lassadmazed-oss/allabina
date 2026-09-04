-- ============================================================
-- 0009_social_partners_cases.sql
--   Module 2 — تصنيفة دراسة الملفّ مع سببها
--   Module 7 — الحالات الاجتماعية والحلول التضامنية
--   Module 8 — الشراكات وتقسيم الحلّ إلى مهامّ
--   Module 9 — حالات تمّ إنجازها (واجهة عمومية)
-- ============================================================

-- ============================================================
-- Module 2 — تصنيف الدراسة
-- ============================================================
do $$ begin
  create type study_track as enum (
    'ready',            -- جاهز تقريباً للتنفيذ
    'needs_property',   -- يحتاج حلّاً عقارياً
    'needs_financing',  -- يحتاج تمويلاً
    'needs_documents',  -- يحتاج استكمال وثائق
    'needs_technical',  -- يحتاج دراسة فنية
    'social'            -- حالة اجتماعية تحتاج مساراً خاصاً
  );
exception when duplicate_object then null; end $$;

alter table housing_requests add column if not exists study_track   study_track;
alter table housing_requests add column if not exists track_reason  text;

comment on column housing_requests.track_reason is
  'لماذا صُنّف الملفّ هكذا — التصنيف بلا سبب لا يفيد أحداً';

-- ============================================================
-- Module 7 — المسار الاجتماعي
-- ============================================================
-- مؤشّرات لترتيب أولوية الدراسة، لا للحكم الآلي على الأشخاص.
-- لا قرار آلي: is_priority يضعه إنسان بعد الدراسة.
create table if not exists social_assessments (
  request_id        uuid primary key references housing_requests(id) on delete cascade,
  household_size    smallint,
  dependents        smallint,
  has_disability    boolean not null default false,
  housing_condition text check (housing_condition in
    ('unsafe','overcrowded','rented_unstable','with_family','homeless','other')),
  income_stability  text check (income_stability in ('none','irregular','low_stable','other')),
  notes             text,
  is_priority       boolean not null default false,
  decided_by        uuid references auth.users(id),
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists social_assessments_touch on social_assessments;
create trigger social_assessments_touch before update on social_assessments
  for each row execute function touch_updated_at();

-- عناصر الحلّ التضامني: أرض + تمويل + مواد + مقاول + دعم…
do $$ begin
  create type contribution_kind as enum (
    'land', 'funding', 'materials', 'labour', 'study', 'admin_support', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type contribution_status as enum ('proposed', 'confirmed', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Module 8 — الشركاء
-- ============================================================
do $$ begin
  create type partner_kind as enum (
    'public',       -- جهة عمومية
    'bank',         -- مؤسّسة مالية
    'company',      -- شركة خاصة
    'developer',    -- باعث عقاري
    'contractor',   -- مقاول
    'supplier',     -- مزوّد مواد
    'association',  -- جمعية
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         partner_kind not null,
  contact_name text,
  phone        text,
  email        text,
  gov_code     text references governorates(code),
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (name, kind)
);

-- مساهمة شريك في حلّ ملفّ بعينه
create table if not exists contributions (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references housing_requests(id) on delete cascade,
  partner_id  uuid references partners(id) on delete set null,
  kind        contribution_kind not null,
  label       text not null,
  value_tnd   numeric(12,2),
  status      contribution_status not null default 'proposed',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contributions_request_idx on contributions (request_id);

drop trigger if exists contributions_touch on contributions;
create trigger contributions_touch before update on contributions
  for each row execute function touch_updated_at();

-- تقسيم الحلّ إلى مهامّ مُسنَدة
do $$ begin
  create type task_status as enum ('todo', 'doing', 'blocked', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references housing_requests(id) on delete cascade,
  title        text not null,
  detail       text,
  partner_id   uuid references partners(id) on delete set null,
  assigned_to  uuid references auth.users(id),
  status       task_status not null default 'todo',
  due_at       date,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_request_idx on tasks (request_id, status);
create index if not exists tasks_due_idx on tasks (due_at) where status in ('todo','doing');

drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();

-- ============================================================
-- Module 9 — حالات تمّ إنجازها
-- ============================================================
-- لا يُنشر شيء بلا موافقة الحريف: published يبقى false حتى تُسجَّل الموافقة.
create table if not exists case_studies (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid references housing_requests(id) on delete set null,

  title_ar       text not null,
  title_fr       text,
  problem_ar     text not null,          -- المشكلة كما كانت
  problem_fr     text,
  solution_ar    text not null,          -- الحلّ كما أُنجز
  solution_fr    text,
  result_ar      text,
  result_fr      text,

  kind           text not null check (kind in
    ('build_on_land','land_and_house','apartment','house','renovation','other')),
  gov_code       text not null references governorates(code),
  delegation_id  int references delegations(id),

  area_m2        numeric(10,2),
  duration_months smallint,
  completed_at   date,

  photo_before   text,
  photo_after    text,
  video_url      text,

  -- الخصوصية: النشر يحتاج موافقة صريحة مسجَّلة
  consent_given  boolean not null default false,
  consent_at     timestamptz,
  anonymised     boolean not null default true,   -- بلا اسم الحريف
  published      boolean not null default false,

  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists case_studies_public_idx
  on case_studies (published, gov_code, delegation_id);

drop trigger if exists case_studies_touch on case_studies;
create trigger case_studies_touch before update on case_studies
  for each row execute function touch_updated_at();

-- منع النشر بلا موافقة — قاعدة في القاعدة نفسها لا في الواجهة فقط
alter table case_studies drop constraint if exists case_studies_consent_required;
alter table case_studies add constraint case_studies_consent_required
  check (published = false or consent_given = true);

-- ============================================================
-- خريطة المعتمديات: أعداد للعرض العمومي، بلا أيّ معطى شخصي
-- ============================================================
create or replace view delegation_activity as
select
  d.id                                                       as delegation_id,
  d.gov_code,
  d.name_ar,
  count(distinct c.id) filter (where c.published)::int        as completed_cases,
  count(distinct r.id) filter (where r.status in
    ('qualified','matched','appointment','contract'))::int    as active_files,
  count(distinct p.id) filter (where p.status = 'approved')::int as available_properties
from delegations d
left join case_studies      c on c.delegation_id = d.id
left join housing_requests  r on r.delegation_id = d.id
left join properties        p on p.delegation_id = d.id
group by d.id, d.gov_code, d.name_ar;

comment on view delegation_activity is
  'أعداد فقط حسب المعتمدية — تغذّي خريطة صفاقس في الواجهة العمومية';

-- ============================================================
-- RLS
-- ============================================================
alter table social_assessments enable row level security;
alter table partners           enable row level security;
alter table contributions      enable row level security;
alter table tasks              enable row level security;
alter table case_studies       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['social_assessments','partners','contributions','tasks']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;

-- الحالات المنشورة وحدها مقروءة للعموم
drop policy if exists case_studies_public_read on case_studies;
create policy case_studies_public_read on case_studies
  for select to anon, authenticated using (published = true);

drop policy if exists case_studies_staff_read on case_studies;
create policy case_studies_staff_read on case_studies
  for select to authenticated using (is_staff());
