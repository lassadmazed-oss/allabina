-- ============================================================
-- 0025_support_assessments.sql · دراسة طلب المساندة وتقرير أهليّته
-- ============================================================
-- طلب المساندة (0009/الاستمارة) يجيب الحكاية. هنا الفريق يفصل فيها:
-- يقيّمها على ستّة معايير مكتوبة، يتثبّت من صحّتها، ويقرّر — بسبب مكتوب.
--
-- مبدآن:
--   1. الدرجة وحدها ما تقرّرش. قرار الإنسان يبقى، والدرجة تعاونه وتوحّد
--      الحكم بين مستشار وآخر.
--   2. لا «أولوية» بلا تثبّت. حكاية مؤثّرة غير متثبَّت منها تبقى «للمراجعة»
--      مهما بلغت درجتها — هذا هو حاجز «مدى صحّتها».
--
-- الأوزان في app_settings لا في الكود: الفريق يعدّلها كي تتغيّر سياسته.
-- ============================================================

do $$ begin
  create type support_decision as enum (
    'pending',            -- لم يُقرَّر بعد
    'accept_support',     -- يدخل مسار المساندة العينية
    'redirect_commercial',-- يرجع للمسار العادي: الحلّ تجاري لا تضامني
    'need_more_info',     -- ناقص تثبّت أو معطى
    'decline'             -- لا يندرج في ما تقدر عليه المنصّة
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type support_band as enum ('priority', 'eligible', 'review', 'not_eligible');
exception when duplicate_object then null; end $$;

create table if not exists support_assessments (
  request_id        uuid primary key references housing_requests(id) on delete cascade,

  -- المعايير: 0 (غائب) → 3 (قصوى). الوصف الكامل لكلّ درجة في lib/support-assessment.ts
  vulnerability     smallint not null default 0 check (vulnerability between 0 and 3),
  urgency           smallint not null default 0 check (urgency between 0 and 3),
  housing_gap       smallint not null default 0 check (housing_gap between 0 and 3),
  self_effort       smallint not null default 0 check (self_effort between 0 and 3),
  feasibility       smallint not null default 0 check (feasibility between 0 and 3),
  verification      smallint not null default 0 check (verification between 0 and 3),

  -- مدى صحّة المعطيات: ما تثبّت الفريق منه فعلاً
  phone_verified        boolean not null default false,
  documents_checked     boolean not null default false,
  home_visit_done       boolean not null default false,
  third_party_confirmed boolean not null default false,   -- عمدة · جمعية · شريك
  inconsistencies_found boolean not null default false,   -- تناقض في الحكاية = حاجز
  verification_note     text,

  -- الناتج (محسوب في الخادم ومخزَّن للقوائم والإحصاء)
  total             smallint not null default 0 check (total between 0 and 100),
  band              support_band not null default 'not_eligible',
  algo_version      text not null default 'v1',

  -- القرار
  decision          support_decision not null default 'pending',
  decision_reason   text,
  decided_by        uuid references auth.users(id),
  decided_at        timestamptz,

  assessed_by       uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- الرفض والتحويل يستوجبان سبباً مكتوباً: قرار بلا سبب لا يُقرأ بعد شهر
alter table support_assessments drop constraint if exists support_assessments_reason_required;
alter table support_assessments add constraint support_assessments_reason_required
  check (decision not in ('decline', 'redirect_commercial') or coalesce(length(decision_reason), 0) >= 10);

create index if not exists support_assessments_band_idx on support_assessments (band, decision);

drop trigger if exists support_assessments_touch on support_assessments;
create trigger support_assessments_touch before update on support_assessments
  for each row execute function touch_updated_at();

alter table support_assessments enable row level security;
drop policy if exists support_assessments_staff_read on support_assessments;
create policy support_assessments_staff_read on support_assessments
  for select to authenticated using (is_staff());

-- الأوزان وحدود الفئات — إعداد إداري
insert into app_settings (key, value, description) values
  ('support.assessment_weights',
   '{"vulnerability":25,"urgency":20,"housing_gap":15,"self_effort":15,"feasibility":15,"verification":10}'::jsonb,
   'أوزان معايير دراسة طلب المساندة — مجموعها 100'),
  ('support.band_thresholds',
   '{"priority":70,"eligible":50,"review":30}'::jsonb,
   'حدود الفئات: أولوية ≥ · مؤهّل ≥ · للمراجعة ≥ · وما دونها غير مؤهّل')
on conflict (key) do nothing;

-- قائمة عمل المساندة: الطلبات الاجتماعية مع درجتها وقرارها
create or replace view support_inbox as
select
  r.id, r.ref_code, r.full_name, r.phone, r.delegation_id, r.urgency, r.status,
  r.problem_note, r.created_at, r.is_demo,
  a.total, a.band, a.decision, a.decided_at, a.inconsistencies_found,
  (a.phone_verified::int + a.documents_checked::int + a.home_visit_done::int + a.third_party_confirmed::int) as checks_done
from housing_requests r
left join support_assessments a on a.request_id = r.id
where r.study_track = 'social';
