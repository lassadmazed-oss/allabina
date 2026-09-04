-- ============================================================
-- 0008_properties_matching.sql
--   Module 5 — بوابة أصحاب الأراضي والعقارات
--   Module 6 — محرّك المطابقة بين المطالب والعروض
-- ============================================================
-- المبدأ: لا ننطلق من العقار الموجود بحثاً عن حريف، بل من حاجة
-- المواطن بحثاً عن أقرب حلّ. لذلك المطابقة تُحسب من المطلب نحو
-- العروض، ونتيجتها اقتراح مفسَّر للفريق — لا قرار آلي.
-- ============================================================

do $$ begin
  create type property_kind as enum ('land', 'house', 'apartment', 'building', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_status as enum (
    'pending',    -- في انتظار المراجعة — لا يظهر لأحد خارج الفريق
    'approved',   -- مراجَع وصالح للمطابقة
    'rejected',   -- مرفوض (معطيات ناقصة أو غير مطابق)
    'reserved',   -- محجوز لملفّ
    'sold'        -- خرج من السوق
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type legal_status as enum ('titled', 'in_progress', 'undivided', 'unregistered', 'other');
exception when duplicate_object then null; end $$;

-- ---------- العقارات المعروضة من المالكين ----------
create table if not exists properties (
  id             uuid primary key default gen_random_uuid(),
  ref_code       text unique not null,

  -- المالك (لا يُعرض للعموم)
  owner_name     text not null,
  owner_phone    text not null,
  owner_email    text,
  owner_note     text,

  -- العقار
  kind           property_kind not null,
  gov_code       text not null references governorates(code),
  delegation_id  int references delegations(id),
  imada_id       int references imadas(id),
  address        text,
  lat            numeric(9,6),
  lng            numeric(9,6),
  area_m2        numeric(10,2),        -- مساحة الأرض
  built_area_m2  numeric(10,2),        -- المساحة المبنية إن وُجدت
  rooms          smallint,
  price_tnd      numeric(12,2),
  negotiable     boolean not null default true,
  legal_status   legal_status,
  description    text,

  -- دورة المراجعة
  status         property_status not null default 'pending',
  review_note    text,
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,

  source         text default 'web',
  consent_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists properties_match_idx
  on properties (status, gov_code, delegation_id, kind);
create index if not exists properties_created_idx on properties (created_at desc);

-- رمز العقار: PR-2026-000123
create sequence if not exists property_ref_seq start 1;

create or replace function next_property_ref() returns text
language sql volatile as $$
  select 'PR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('property_ref_seq')::text, 6, '0');
$$;

alter table properties alter column ref_code set default next_property_ref();

drop trigger if exists properties_touch on properties;
create trigger properties_touch before update on properties
  for each row execute function touch_updated_at();

-- ---------- الوسائط: صور، فيديو، وثائق ----------
-- في هذه المرحلة نسجّل الوصف والرابط؛ الرفع إلى Supabase Storage يأتي لاحقاً.
create table if not exists property_media (
  id          bigserial primary key,
  property_id uuid not null references properties(id) on delete cascade,
  kind        text not null check (kind in ('photo', 'video', 'document')),
  url         text,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists property_media_property_idx on property_media (property_id);

-- ---------- المطابقات ----------
do $$ begin
  create type match_status as enum (
    'suggested',   -- اقترحه المحرّك
    'shortlisted', -- الفريق احتفظ به
    'proposed',    -- عُرض على الحريف
    'accepted',
    'rejected'
  );
exception when duplicate_object then null; end $$;

create table if not exists matches (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references housing_requests(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  score       smallint not null check (score between 0 and 100),
  reasons     jsonb not null default '[]'::jsonb,  -- أسباب المطابقة مفسَّرة
  status      match_status not null default 'suggested',
  note        text,
  actor       uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (request_id, property_id)
);

create index if not exists matches_request_idx on matches (request_id, score desc);
create index if not exists matches_property_idx on matches (property_id);

drop trigger if exists matches_touch on matches;
create trigger matches_touch before update on matches
  for each row execute function touch_updated_at();

-- ---------- RLS ----------
alter table properties     enable row level security;
alter table property_media enable row level security;
alter table matches        enable row level security;

-- لا سياسات لدور anon: العرض لا يظهر آلياً للعموم، يمرّ أوّلاً بالمراجعة.
do $$
declare t text;
begin
  foreach t in array array['properties','property_media','matches']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;

-- ---------- إحصائيات العرض للوحة القيادة ----------
create or replace view property_stats as
select
  count(*)::int                                          as total,
  count(*) filter (where status = 'pending')::int        as pending,
  count(*) filter (where status = 'approved')::int       as approved,
  count(*) filter (where status = 'reserved')::int       as reserved,
  count(*) filter (where kind = 'land' and status = 'approved')::int as land_available
from properties;
