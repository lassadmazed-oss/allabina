-- ============================================================
-- 0040_request_flow_fields.sql · الاستمارة تسأل كلّ مسار سؤاله
-- ============================================================
-- الخطّة «خريطة الاستمارة حسب نوع المطلب»: خمسة مسارات، واستمارة واحدة
-- كانت تسأل الجميع الأسئلة نفسها. هذه الأعمدة هي ما ينقص كلّ مسار:
--
--   الشقّة    — جاهزة أم في طور البناء · الطابق · مصعد · موقف
--   الترميم   — نوع الأشغال · المساحة الحالية والمضافة · «الدار الحالية»
--   من يبني   — الأرض داخل مثال التهيئة؟ فيها بناء؟ عنده رسم؟
--   من يبحث   — تنازلان جديدان: أرض بشهادة عادية · أرض في تجزئة
--
-- كلّها قابلة للفراغ: الملفّات القائمة لا تُمسّ.
-- ============================================================

-- ---------- الشقّة ----------
alter table housing_requests add column if not exists apartment_state text
  check (apartment_state in ('ready', 'off_plan'));
alter table housing_requests add column if not exists floor_pref text
  check (floor_pref in ('ground', 'upper', 'any'));
alter table housing_requests add column if not exists elevator_needed boolean not null default false;
alter table housing_requests add column if not exists parking_needed  boolean not null default false;

-- ---------- الترميم ----------
alter table housing_requests add column if not exists renovation_works  text[];
alter table housing_requests add column if not exists current_area_m2   numeric(8,2);
alter table housing_requests add column if not exists extension_area_m2 numeric(8,2);

comment on column housing_requests.renovation_works is
  'repair · extension · add_floor · interior · facade · roof · networks — اختيار متعدّد';
comment on column housing_requests.current_area_m2 is 'مساحة الدار القائمة — للترميم';
comment on column housing_requests.extension_area_m2 is 'ما يُضاف — للتوسعة وحدها';

-- ---------- الأرض المملوكة ----------
alter table request_land add column if not exists in_urban_plan text
  check (in_urban_plan in ('yes', 'no', 'unknown'));
alter table request_land add column if not exists existing_building text
  check (existing_building in ('none', 'demolish', 'keep'));
alter table request_land add column if not exists has_plans text
  check (has_plans in ('none', 'draft', 'approved'));

comment on column request_land.in_urban_plan is 'داخل مثال التهيئة؟ — يحسم إمكانية الرخصة';
comment on column request_land.existing_building is 'بناء قائم: الهدم بند في الـdevis، والمحافظة تحوّل المشروع إلى توسعة';
comment on column request_land.has_plans is 'رسم معماري: يحدّد إن كان يحتاج معمارياً من الشبكة أوّلاً';

-- ---------- الدار الحالية — لمن يرمّم ----------
-- تعوّض خطوة «الأرض». فيها سؤال يوقف المسار: المستأجر لا يرمّم ما لا يملكه.
create table if not exists request_home (
  request_id         uuid primary key references housing_requests(id) on delete cascade,
  ownership          text check (ownership in ('owner', 'heirs', 'tenant')),
  building_age_years int  check (building_age_years between 0 and 200),
  title_status       text check (title_status in ('titled', 'in_progress', 'undivided', 'other')),
  has_permit         boolean not null default false,
  notes              text
);

alter table request_home enable row level security;
drop policy if exists request_home_staff_read on request_home;
create policy request_home_staff_read on request_home
  for select to authenticated using (is_staff());

-- ---------- تنازلان لمن يبحث عن أرض ----------
-- title: يقبل أرضاً بشهادة ملكية عادية لا رسم عقاري — نصف أراضي الجهة كذلك.
-- lot:   يقبل أرضاً في تجزئة لا قطعة مستقلّة.
alter type flexibility_kind add value if not exists 'title';
alter type flexibility_kind add value if not exists 'lot';
