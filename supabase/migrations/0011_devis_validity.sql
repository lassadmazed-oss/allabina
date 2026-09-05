-- ============================================================
-- 0011_devis_validity.sql · صلاحية العرض التقديري
-- ============================================================
-- العرض صالح مدّة محدودة: بعدها تتغيّر الأسعار وتفقد الأرقام معناها.
-- المدّة إعداد إداري لا رقم في الكود — تُغيَّر من الـBack-office.
-- ============================================================

alter table devis add column if not exists valid_until date;

comment on column devis.valid_until is
  'آخر يوم يبقى فيه العرض صالحاً. يُحسب عند التوليد من devis.validity_days';

create index if not exists devis_validity_idx on devis (valid_until)
  where status in ('draft', 'sent');

insert into app_settings (key, value, description) values
  ('devis.validity_days', '30'::jsonb,
   'مدّة صلاحية العرض التقديري بالأيّام — تظهر على كلّ عرض وتُحتسب عند توليده')
on conflict (key) do nothing;

-- العروض القديمة (إن وُجدت) تأخذ المدّة نفسها انطلاقاً من تاريخ إنشائها
update devis
   set valid_until = (created_at + interval '30 days')::date
 where valid_until is null;
