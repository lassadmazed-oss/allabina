-- ============================================================
-- 0017_request_fields.sql · الحقول الناقصة في استمارة المطلب
-- ============================================================
-- خمسة نقائص كانت تخلّي المستشار يتّصل بالحريف باش يسأل على حاجات
-- كان لازم الاستمارة تسألها من الأوّل:
--
--   1. نوعان من المطالب ما كانوش موجودين: ترميم/توسعة، ومشكل آخر.
--   2. درجة الاستعجال — ملفّ فيه إشعار بالخروج ما هوش كيف ملفّ يخطّط
--      لسنتين. الترتيب في الـBack-office يلزمو يعرف الفرق.
--   3. المرونة — واش الحريف يقبل منطقة أخرى ولا مساحة أصغر؟ هذا اللي
--      يفتح الحلول كي ما يلقاش عرضاً مطابقاً تماماً.
--   4. FOPROLOS وبرامج السكن الاجتماعي — شرط أهلية يقرّر مساراً كاملاً.
--   5. ملاحظة حرّة: «شنوّة المشكل بالضبط؟» بكلام الحريف.
-- ============================================================

-- ---------- نوعا مطلب جديدان ----------
-- renovation: ترميم أو توسعة مسكن قائم · other: مشكل سكني آخر
do $$ begin
  alter type request_type add value if not exists 'renovation';
exception when others then null; end $$;

do $$ begin
  alter type request_type add value if not exists 'other';
exception when others then null; end $$;

-- ---------- درجة الاستعجال ----------
do $$ begin
  create type urgency_level as enum ('planning', 'within_year', 'urgent', 'critical');
exception when duplicate_object then null; end $$;

comment on type urgency_level is
  'planning: يخطّط بلا أجل · within_year: خلال سنة · urgent: مستعجل · critical: وضعية حرجة';

-- ---------- المرونة ----------
-- ما نخزّنوش «مرن» أو «غير مرن»: نخزّنو على شنوّة بالضبط مستعدّ يتنازل.
do $$ begin
  create type flexibility_kind as enum ('area', 'zone', 'standing', 'timing', 'type', 'budget');
exception when duplicate_object then null; end $$;

alter table housing_requests add column if not exists urgency        urgency_level;
alter table housing_requests add column if not exists urgency_note   text;
alter table housing_requests add column if not exists flexibility    flexibility_kind[];
alter table housing_requests add column if not exists problem_note   text;

-- ---------- السكن الاجتماعي والبرامج المدعّمة ----------
-- الأهلية ما تتقرّرش من عندنا: نجمّعو المعطيات اللي عليها يتقرّر،
-- والشروط الرسمية تُراجَع مع الجهة المعنية عند الإيداع.
alter table housing_requests add column if not exists foprolos_interest  boolean not null default false;
alter table housing_requests add column if not exists is_first_home      boolean;
alter table housing_requests add column if not exists has_social_housing boolean;
alter table housing_requests add column if not exists cnss_affiliated    boolean;
alter table housing_requests add column if not exists cnss_number_years  smallint;

comment on column housing_requests.foprolos_interest is
  'الحريف يهمّه برنامج سكن اجتماعي مدعّم — لا يعني الأهلية، تُدرس مع الجهة المعنية';

create index if not exists housing_requests_urgency_idx
  on housing_requests (urgency, created_at desc) where urgency is not null;

create index if not exists housing_requests_foprolos_idx
  on housing_requests (foprolos_interest) where foprolos_interest;

-- ---------- ترتيب العمل حسب الاستعجال ----------
-- الوضعية الحرجة تطلع فوق مهما كان تاريخ المطلب.
create or replace view request_priority as
select
  r.id,
  r.ref_code,
  r.full_name,
  r.status,
  r.urgency,
  r.created_at,
  case r.urgency
    when 'critical'    then 4
    when 'urgent'      then 3
    when 'within_year' then 2
    when 'planning'    then 1
    else 0
  end as urgency_rank,
  r.is_demo
from housing_requests r
where r.status not in ('contract', 'rejected');

comment on view request_priority is
  'ترتيب الملفّات حسب الاستعجال ثمّ الأقدمية — مدخل قائمة عمل المستشار';
