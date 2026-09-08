-- ============================================================
-- 0023_sms_log.sql · سجلّ الرسائل القصيرة
-- ============================================================
-- المواطن يسجّل مطلبه فيصله رمزه المرجعي على هاتفه فوراً — لا يضيّعه
-- ولا يحتاج يحفظه من الشاشة. المزوّد WinSMS.tn، والمُرسِل MAZED.
--
-- كلّ محاولة إرسال تُسجَّل: لمن، ماذا، وبأيّ نتيجة. السجلّ للفريق فقط
-- (فيه أرقام هواتف)، ويُحذف مع مطلبه.
-- ============================================================

do $$ begin
  create type sms_status as enum ('queued', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists sms_log (
  id            bigserial primary key,
  request_id    uuid references housing_requests(id) on delete cascade,
  property_id   uuid references properties(id) on delete cascade,
  to_number     text not null,                 -- 216XXXXXXXX
  template      text not null,                 -- request_confirmation · property_confirmation · …
  body          text not null,
  segments      smallint,
  status        sms_status not null default 'queued',
  provider      text not null default 'winsms',
  provider_ref  text,                          -- مرجع المزوّد لمتابعة الحالة
  response      text,                          -- ردّ المزوّد كما جاء، مقصوصاً
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

create index if not exists sms_log_request_idx on sms_log (request_id, created_at desc);
create index if not exists sms_log_status_idx  on sms_log (status, created_at desc);

-- رسالة تأكيد واحدة لكلّ مطلب: إعادة الإرسال قرار إداري لا حادث
create unique index if not exists sms_log_one_confirmation_idx
  on sms_log (request_id, template)
  where request_id is not null and template = 'request_confirmation' and status in ('queued', 'sent');

alter table sms_log enable row level security;

drop policy if exists sms_log_staff_read on sms_log;
create policy sms_log_staff_read on sms_log
  for select to authenticated using (is_staff());

-- مفاتيح الإعداد تُدار من الـBack-office لا من الكود
insert into app_settings (key, value, description) values
  ('sms.enabled',       'true'::jsonb,   'إرسال رسائل التأكيد بالرمز المرجعي عند تسجيل المطلب'),
  ('sms.sender',        '"MAZED"'::jsonb, 'اسم المُرسِل المصادَق عليه لدى WinSMS'),
  ('sms.min_balance',   '50'::jsonb,     'تحت هذا الرصيد يُنبَّه الفريق ولا تُرسل رسائل غير أساسية')
on conflict (key) do nothing;
