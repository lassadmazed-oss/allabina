-- ============================================================
-- 0026_network_contact.sql · رمز المهني ولغته، وقنوات اتّصال المنصّة
-- ============================================================
-- المهني يسجّل ملفّه ويخرج من الصفحة بلا رمز ولا رسالة: لا يعرف كيف
-- يذكّرنا بنفسه ولا كيف نوصل إليه. هنا:
--   · رمز مرجعي IN-2026-000001 لكلّ مهني، ولغته، ورسالة قصيرة بالرمز.
--   · قنوات اتّصال المنصّة في الإعدادات (هاتف · واتساب · بريد · أوقات)،
--     تُعرض في صفحات الشكر وتُعدَّل من الـBack-office.
-- ============================================================

create sequence if not exists intervenant_ref_seq start 1;

create or replace function next_intervenant_ref() returns text
language sql as $$
  select 'IN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('intervenant_ref_seq')::text, 6, '0');
$$;

alter table intervenants add column if not exists ref_code text;
update intervenants set ref_code = next_intervenant_ref() where ref_code is null;
alter table intervenants alter column ref_code set default next_intervenant_ref();
alter table intervenants alter column ref_code set not null;
create unique index if not exists intervenants_ref_code_idx on intervenants (ref_code);

alter table intervenants add column if not exists lang text not null default 'ar'
  check (lang in ('ar', 'fr'));

-- سجلّ الرسائل يعرف المهني أيضاً
alter table sms_log add column if not exists intervenant_id uuid references intervenants(id) on delete cascade;
create index if not exists sms_log_intervenant_idx on sms_log (intervenant_id, created_at desc);

-- قنوات الاتّصال: فارغة حتى يعمّرها الفريق — الصفحة لا تعرض إلّا ما عُمّر
insert into app_settings (key, value, description) values
  ('contact.phone',    '""'::jsonb, 'هاتف اللَّبنة الذي يظهر للعموم في صفحات الشكر'),
  ('contact.whatsapp', '""'::jsonb, 'رقم واتساب اللَّبنة (بالصيغة الدولية 216…)'),
  ('contact.email',    '""'::jsonb, 'بريد اللَّبنة العمومي'),
  ('contact.hours',    '""'::jsonb, 'أوقات الردّ، مثال: من الإثنين إلى الجمعة 9–17')
on conflict (key) do nothing;
