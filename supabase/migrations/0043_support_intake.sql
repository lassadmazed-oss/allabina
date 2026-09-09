-- ============================================================
-- 0043_support_intake.sql · طلب المساندة يحمل ما يلزم لدراسته
-- ============================================================
-- الاستمارة كانت تسأل ستّة أشياء، والفريق يقيّم ستّة معايير (0025):
-- هشاشة · استعجال · فجوة سكن · جهد ذاتي · قابلية تدخّل عيني · صحّة
-- المعطيات. أغلب ما يلزم للتقييم لم يكن يُسأل، فكان يُستدرَك في مكالمة —
-- أو لا يُستدرَك.
--
-- جدول مستقلّ عن social_assessments: ذاك سطر يقرّر فيه الفريق
-- (is_priority · decided_by)، وهذا ما صرّح به صاحب الطلب كما صرّح به.
-- المقادير الحسّاسة (الدخل، الادّخار) شرائح لا أرقاماً: يكفي للترتيب،
-- ولا يجعل الاستمارة استجواباً.
-- ============================================================

create table if not exists support_intake (
  request_id         uuid primary key references housing_requests(id) on delete cascade,

  -- شكون يطلب
  for_whom           text check (for_whom in ('self', 'relative', 'neighbor')),
  beneficiary_name   text,

  -- الحاجة
  need_kinds         text[],   -- roof · room · materials · labor · study · admin · relocation · utilities · other
  triggers           text[],   -- eviction · collapse · flood · illness · loss · job_loss · disaster · none

  -- الدار اللي فيها توّا
  rooms_count        smallint check (rooms_count between 0 and 20),
  years_there        smallint check (years_there between 0 and 80),
  utilities          text[],   -- water · power · sewage
  building_state     text check (building_state in ('sound', 'cracks', 'danger', 'no_roof', 'unfinished')),

  -- العايلة
  children_count     smallint check (children_count between 0 and 20),
  elderly_count      smallint check (elderly_count between 0 and 10),
  disability_note    text,
  head_status        text check (head_status in ('couple', 'single_mother', 'single_father', 'widowed', 'divorced', 'single')),

  -- الدخل والتغطية
  income_range       text check (income_range in ('lt300', '300_600', '600_1000', 'gt1000')),
  main_earner_job    text,
  social_coverage    text[],   -- cnss · cnrps · amg1 · amg2 · none
  existing_aid       text check (existing_aid in ('yes', 'no', 'unknown')),

  -- الجهد الذاتي
  land_status        text check (land_status in ('titled', 'certificate', 'heirs', 'none')),
  has_materials      boolean not null default false,
  savings_range      text check (savings_range in ('none', 'lt1000', '1000_3000', 'gt3000')),
  family_help        boolean not null default false,
  can_work           boolean not null default false,
  steps_taken        text[],   -- municipality · governorate · association · bank · none

  -- التثبّت
  can_visit          boolean not null default false,
  reference_note     text,
  best_time          text check (best_time in ('morning', 'afternoon', 'evening')),
  alt_phone          text,
  address_note       text,

  created_at         timestamptz not null default now()
);

comment on table support_intake is
  'تصريح صاحب طلب المساندة — مرتّب على معايير الدراسة الستّة. لا قرار فيه.';

alter table support_intake enable row level security;
drop policy if exists support_intake_staff_read on support_intake;
create policy support_intake_staff_read on support_intake
  for select to authenticated using (is_staff());
