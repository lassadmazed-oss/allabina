-- ============================================================
-- 0012_support_ledger.sql · دفتر الشفافية وحالات تحتاج مساندة
-- ============================================================
-- هذه الوحدة لا تمسّ مالاً: تنظيم حاجيات وتعهّدات عينية وتوثيقها.
-- التحصيل يبقى خلف باب مغلق حتى يستكمل الإطار القانوني.
-- ============================================================

-- ---------- حالة تحتاج مساندة ----------
-- لا تُنشر بلا موافقة صاحبها، ومجهّلة الهوية افتراضياً — نفس قاعدة
-- الحالات المنجزة، محروسة بقيد في القاعدة لا في الواجهة.
create table if not exists support_cases (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references housing_requests(id) on delete cascade,

  title_ar      text not null,          -- الحاجة لا الشخص: «عائلة تحتاج سقفاً لغرفتين»
  title_fr      text,
  summary_ar    text not null,
  summary_fr    text,
  gov_code      text not null references governorates(code),
  delegation_id int references delegations(id),

  consent_given boolean not null default false,
  consent_at    timestamptz,
  anonymised    boolean not null default true,
  published     boolean not null default false,
  closed_at     timestamptz,            -- اكتملت الحاجة أو أُغلقت

  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (request_id)
);

alter table support_cases drop constraint if exists support_cases_consent_required;
alter table support_cases add constraint support_cases_consent_required
  check (published = false or consent_given = true);

create index if not exists support_cases_public_idx
  on support_cases (published, gov_code) where published;

drop trigger if exists support_cases_touch on support_cases;
create trigger support_cases_touch before update on support_cases
  for each row execute function touch_updated_at();

-- ---------- دفتر الشفافية ----------
-- سجلّ يُضاف إليه ولا يُعدَّل: ماذا طُلب، ماذا وصل، من قدّمه، ومتى.
do $$ begin
  create type ledger_event as enum ('needed', 'pledged', 'confirmed', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists support_ledger (
  id              bigserial primary key,
  request_id      uuid not null references housing_requests(id) on delete cascade,
  contribution_id uuid references contributions(id) on delete set null,
  event           ledger_event not null,
  label           text not null,        -- «200 كيس إسمنت»
  kind            contribution_kind,
  quantity_note   text,                 -- «120 كيس من أصل 200»
  value_tnd       numeric(12,2),        -- داخلي: لا يُعرض في الصفحة العمومية
  partner_id      uuid references partners(id) on delete set null,
  partner_public  text,                 -- الاسم كما يُعرض، أو «متبرّع لم يرغب في ذكر اسمه»
  note            text,
  actor           uuid references auth.users(id),
  occurred_at     date not null default current_date,
  created_at      timestamptz not null default now()
);

-- ما وصل يشير إلى الحاجة التي يسدّها: هكذا نعرف «قُضيت 3 حاجيات من 5»
-- بلا أيّ مبلغ، وبلا عدّاد مال.
alter table support_ledger
  add column if not exists need_id bigint references support_ledger(id) on delete set null;

create index if not exists support_ledger_need_idx
  on support_ledger (need_id) where need_id is not null;

create index if not exists support_ledger_request_idx
  on support_ledger (request_id, occurred_at desc, id desc);

comment on table support_ledger is
  'سجلّ إضافي لا يُعدَّل ولا يُحذف منه — التصحيح يكون بقيد جديد لا بتعديل قديم';

-- منع التعديل والحذف على مستوى القاعدة نفسها
create or replace function support_ledger_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'دفتر الشفافية سجلّ إضافي: التصحيح يكون بقيد جديد، لا بتعديل أو حذف';
end $$;

drop trigger if exists support_ledger_no_update on support_ledger;
create trigger support_ledger_no_update before update or delete on support_ledger
  for each row execute function support_ledger_append_only();

-- ---------- تعهّدات عينية من العموم ----------
-- عينية فقط: مواد · يد عاملة · دراسة · نقل. لا مبالغ ولا وسيلة دفع.
create table if not exists support_pledges (
  id             uuid primary key default gen_random_uuid(),
  support_case_id uuid references support_cases(id) on delete set null,
  full_name      text not null,
  phone          text not null,
  email          text,
  kind           contribution_kind not null,
  label          text not null,         -- ما الذي يعرضه بالضبط
  note           text,
  status         text not null default 'new'
                 check (status in ('new', 'contacted', 'accepted', 'declined')),
  handled_by     uuid references auth.users(id),
  consent_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

-- لا مال عبر المنصة: القيد في القاعدة حتى لا يُفتح الباب سهواً من الواجهة
alter table support_pledges drop constraint if exists support_pledges_in_kind_only;
alter table support_pledges add constraint support_pledges_in_kind_only
  check (kind <> 'funding');

create index if not exists support_pledges_status_idx on support_pledges (status, created_at desc);

-- ---------- عرض عمومي: أعداد لا مبالغ ----------
-- عمداً بلا أيّ مجموع مالي: لا عدّاد «جُمع X من Y».
create or replace view support_case_public as
select
  c.id,
  c.title_ar, c.title_fr, c.summary_ar, c.summary_fr,
  c.gov_code, c.delegation_id, c.created_at,
  count(l.id) filter (where l.event = 'needed')::int    as needs_count,
  count(l.id) filter (where l.event = 'delivered')::int as delivered_count,
  count(l.id) filter (where l.event in ('pledged','confirmed'))::int as pledged_count,
  count(distinct l.need_id) filter (where l.event = 'delivered')::int as covered_needs
from support_cases c
left join support_ledger l on l.request_id = c.request_id
where c.published and c.closed_at is null
group by c.id;

-- ---------- RLS ----------
alter table support_cases   enable row level security;
alter table support_ledger  enable row level security;
alter table support_pledges enable row level security;

drop policy if exists support_cases_public_read on support_cases;
create policy support_cases_public_read on support_cases
  for select to anon, authenticated using (published = true);

drop policy if exists support_cases_staff_read on support_cases;
create policy support_cases_staff_read on support_cases
  for select to authenticated using (is_staff());

do $$
declare t text;
begin
  foreach t in array array['support_ledger','support_pledges']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;
