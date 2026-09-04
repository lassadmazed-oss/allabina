-- ============================================================
-- اللَّبنة للبناء والإعمار — ALLABINA
-- 0001_init.sql · المخطّط الأساسي للنسخة التجريبية
-- ============================================================
-- قاعدة معمارية: المتصفّح لا يكتب هنا مباشرة. كلّ إدراج يمرّ عبر
-- الخادم (service_role) الذي يتحقّق من المدخلات ويحسب التنقيط.
-- ============================================================

-- ---------- الأنواع ----------
do $$ begin
  create type request_type as enum ('build_on_land','land_and_house','apartment','economic','rent_to_own');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('new','contacted','qualified','matched','appointment','contract','on_hold','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum ('public','private','self_employed','informal','retired','expat','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type score_band as enum ('A','B','C','D');
exception when duplicate_object then null; end $$;

-- ---------- مراجع جغرافية ----------
create table if not exists governorates (
  code      text primary key,
  name_ar   text not null,
  name_fr   text,
  is_active boolean not null default false   -- true فقط للولايات المفتوحة للمعالجة
);

create table if not exists delegations (
  id       serial primary key,
  gov_code text not null references governorates(code) on delete cascade,
  name_ar  text not null,
  unique (gov_code, name_ar)
);

-- ---------- فريق اللَّبنة (النفاذ إلى لوحة القيادة) ----------
create table if not exists staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'agent' check (role in ('admin','agent','viewer')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- إعدادات المحاكي ----------
create table if not exists app_settings (
  key         text primary key,
  value       jsonb,                          -- null = غير معبّأ → المحاكي لا يشتغل
  description text,
  updated_at  timestamptz not null default now()
);

-- ---------- أسعار مرجعية ----------
create table if not exists price_references (
  id               serial primary key,
  gov_code         text not null references governorates(code) on delete cascade,
  zone             text check (zone in ('city','suburb','rural')),
  product          text not null check (product in ('land','construction','apartment','house')),
  price_per_m2_tnd numeric(10,2),             -- null = غير معبّأ بعد
  source           text,                      -- من أين جاء الرقم ومتى
  updated_at       timestamptz not null default now(),
  unique (gov_code, zone, product)
);

-- ---------- رمز المطلب: LB-2026-000412 ----------
create sequence if not exists request_ref_seq start 1;

create or replace function next_ref_code() returns text
language sql volatile as $$
  select 'LB-' || to_char(now(),'YYYY') || '-' || lpad(nextval('request_ref_seq')::text, 6, '0');
$$;

-- ---------- المطلب ----------
create table if not exists housing_requests (
  id              uuid primary key default gen_random_uuid(),
  ref_code        text unique not null default next_ref_code(),
  full_name       text not null,
  phone           text not null,                       -- +216XXXXXXXX أو مفتاح دولي
  email           text,
  gov_code        text not null references governorates(code),
  delegation_id   int references delegations(id),
  request_type    request_type not null,
  desired_area_m2 int check (desired_area_m2 between 40 and 400),
  bedrooms        smallint check (bedrooms between 1 and 6),
  horizon         text check (horizon in ('now','6m','12m','24m')),
  owns_land       boolean not null default false,
  status          request_status not null default 'new',
  consent_at      timestamptz not null,                -- موافقة صريحة على معالجة المعطيات
  source          text default 'web',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists housing_requests_filter_idx on housing_requests (gov_code, request_type, status);
create index if not exists housing_requests_created_idx on housing_requests (created_at desc);
create index if not exists housing_requests_phone_idx   on housing_requests (phone);

-- ---------- تفاصيل الأرض (مسار البناء) ----------
create table if not exists request_land (
  request_id     uuid primary key references housing_requests(id) on delete cascade,
  area_m2        int check (area_m2 between 50 and 5000),
  title_status   text check (title_status in ('titled','in_progress','undivided','other')),
  has_water      boolean default false,
  has_power      boolean default false,
  has_road       boolean default false,
  has_permit     boolean default false,
  notes          text
);

-- ---------- الملفّ المالي ----------
create table if not exists financial_profiles (
  request_id         uuid primary key references housing_requests(id) on delete cascade,
  monthly_income_tnd numeric(10,2) not null check (monthly_income_tnd >= 0),
  spouse_income_tnd  numeric(10,2) default 0,
  other_income_tnd   numeric(10,2) default 0,
  existing_loans_tnd numeric(10,2) default 0,          -- مجموع الأقساط الجارية
  down_payment_tnd   numeric(12,2) default 0,          -- التسبقة المتوفّرة
  max_monthly_tnd    numeric(10,2),                    -- القسط المصرّح بالقدرة عليه
  employment         employment_type not null,
  seniority_months   int default 0,
  is_expat           boolean not null default false,
  expat_country      text,
  return_horizon     text,
  created_at         timestamptz not null default now()
);

-- ---------- التنقيط ----------
create table if not exists scores (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references housing_requests(id) on delete cascade,
  total          smallint not null check (total between 0 and 100),
  band           score_band not null,
  breakdown      jsonb not null,                       -- النقاط حسب كلّ معيار + سببها
  max_loan_tnd   numeric(12,2),
  max_budget_tnd numeric(12,2),
  algo_version   text not null default 'v1',
  computed_at    timestamptz not null default now()
);

create index if not exists scores_request_idx on scores (request_id, computed_at desc);

-- ---------- سجلّ الأثر ----------
create table if not exists request_events (
  id          bigserial primary key,
  request_id  uuid not null references housing_requests(id) on delete cascade,
  event_type  text not null,                            -- created | status_change | note | contact
  from_status request_status,
  to_status   request_status,
  actor       uuid references auth.users(id),           -- null = النظام
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists request_events_request_idx on request_events (request_id, created_at desc);

-- ---------- updated_at تلقائي ----------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists housing_requests_touch on housing_requests;
create trigger housing_requests_touch before update on housing_requests
  for each row execute function touch_updated_at();

-- ---------- تسجيل إنشاء المطلب في سجلّ الأثر ----------
create or replace function log_request_created() returns trigger
language plpgsql as $$
begin
  insert into request_events (request_id, event_type, to_status, note)
  values (new.id, 'created', new.status, 'تسجيل مطلب جديد');
  return new;
end $$;

drop trigger if exists housing_requests_log_created on housing_requests;
create trigger housing_requests_log_created after insert on housing_requests
  for each row execute function log_request_created();

-- ============================================================
-- RLS — لا نفاذ من المتصفّح إطلاقاً
-- ============================================================
alter table housing_requests   enable row level security;
alter table request_land       enable row level security;
alter table financial_profiles enable row level security;
alter table scores             enable row level security;
alter table request_events     enable row level security;
alter table staff              enable row level security;
alter table app_settings       enable row level security;
alter table price_references   enable row level security;
alter table governorates       enable row level security;
alter table delegations        enable row level security;

-- دالة مساعدة: هل المستعمل الحالي من الفريق؟
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff s where s.user_id = auth.uid() and s.active);
$$;

-- المراجع الجغرافية: قراءة علنية (تعبئة قوائم الاستمارة)
drop policy if exists governorates_public_read on governorates;
create policy governorates_public_read on governorates for select to anon, authenticated using (true);

drop policy if exists delegations_public_read on delegations;
create policy delegations_public_read on delegations for select to anon, authenticated using (true);

-- كلّ ما عدا ذلك: الفريق فقط. دور anon بلا أيّ سياسة → مرفوض ضمنياً.
do $$
declare t text;
begin
  foreach t in array array['housing_requests','request_land','financial_profiles','scores','request_events','app_settings','price_references']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;

drop policy if exists housing_requests_staff_update on housing_requests;
create policy housing_requests_staff_update on housing_requests for update to authenticated
  using (is_staff()) with check (is_staff());

drop policy if exists staff_self_read on staff;
create policy staff_self_read on staff for select to authenticated using (user_id = auth.uid() or is_staff());
