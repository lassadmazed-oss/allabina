-- ============================================================
-- 0006_public_tracking.sql · صفحة متابعة مطالب الحرفاء
-- ============================================================
-- ما يُعرض للحريف يبقى منفصلاً عن الملاحظات الداخلية:
--   public_update    = آخر تحيين مكتوب للحريف (يكتبه الفريق عمداً)
--   public_next_step = المرحلة القادمة
-- الملاحظات الداخلية والإجراءات تبقى في request_interactions و next_action
-- ولا تظهر أبداً في الفضاء العمومي.
-- ============================================================

-- نوع الإشكال — تصنيف الفريق للملفّ
do $$ begin
  create type problem_kind as enum (
    'financing',      -- إشكال تمويل
    'land',           -- إشكال عقاري/أرض
    'documents',      -- وثائق ناقصة
    'budget_gap',     -- الميزانية أقلّ من المطلوب
    'no_offer',       -- ما فمّاش عرض مناسب في المنطقة
    'other'
  );
exception when duplicate_object then null; end $$;

-- وضع التمويل
do $$ begin
  create type financing_state as enum (
    'not_started',    -- ما بداش
    'studying',       -- بصدد الدراسة
    'bank_submitted', -- الملفّ عند البنك
    'approved',       -- تمّت الموافقة
    'refused',        -- رفض بنكي
    'self_funded'     -- تمويل ذاتي
  );
exception when duplicate_object then null; end $$;

alter table housing_requests add column if not exists problem_type      problem_kind;
alter table housing_requests add column if not exists financing_state   financing_state not null default 'not_started';
alter table housing_requests add column if not exists public_update     text;
alter table housing_requests add column if not exists public_next_step  text;
alter table housing_requests add column if not exists public_updated_at timestamptz;

comment on column housing_requests.public_update is
  'آخر تحيين كما يُعرض للحريف في صفحة المتابعة — لا يحتوي ملاحظات داخلية';
comment on column housing_requests.public_next_step is
  'المرحلة القادمة كما تُعرض للحريف';

-- فهرس البحث بالهاتف في صفحة المتابعة
create index if not exists housing_requests_phone_lookup_idx on housing_requests (phone);

-- تحيين public_updated_at تلقائياً عند تغيير النصّ المعروض
create or replace function touch_public_update() returns trigger
language plpgsql as $$
begin
  if new.public_update is distinct from old.public_update
     or new.public_next_step is distinct from old.public_next_step then
    new.public_updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists housing_requests_public_update on housing_requests;
create trigger housing_requests_public_update before update on housing_requests
  for each row execute function touch_public_update();

-- ============================================================
-- الإحصائيات العمومية: أعداد مجرّدة بلا أيّ معطى شخصي
-- ============================================================
create or replace view public_request_stats as
select
  count(*)::int                                                              as received,
  count(*) filter (where status in ('matched','contract'))::int              as resolved,
  count(*) filter (where status in ('new','contacted','qualified','appointment'))::int as in_progress,
  count(*) filter (where status = 'on_hold')::int                            as waiting,
  count(*) filter (where status = 'rejected')::int                           as closed,
  max(updated_at)                                                            as last_activity_at
from housing_requests;

comment on view public_request_stats is
  'أعداد فقط — لا أسماء ولا هواتف ولا مبالغ. تُعرض في صفحة متابعة المطالب.';
