-- ============================================================
-- 0047_sfax_north_delegation.sql · «صفاقس الغربية» تُسمّى «صفاقس الشمالية»
-- ============================================================
-- الاسم كما يستعمله فريق اللبنة والحرفاء. التسمية وحدها تتبدّل: المعرّف
-- يبقى هو هو، فكلّ مطلب وعقار وحالة وعمادة يشير إليه يبقى مربوطاً.
--
-- 0002 و0005 صارتا تحملان الاسم الجديد في قائمتيهما، حتى لا يعيد تشغيل
-- الهجرات إدراج الاسم القديم. وإن حدث ذلك على قاعدة قديمة، فالسطر المُعاد
-- إدراجه بلا أيّ مرجع يُحذف هنا.
-- ============================================================

do $$
declare
  west  int;
  north int;
begin
  select id into west  from delegations where gov_code = 'SFX' and name_ar = 'صفاقس الغربية';
  select id into north from delegations where gov_code = 'SFX' and name_ar = 'صفاقس الشمالية';

  if west is not null and north is null then
    update delegations set name_ar = 'صفاقس الشمالية' where id = west;
  elsif west is not null and north is not null then
    if not exists (select 1 from housing_requests  where delegation_id = west)
       and not exists (select 1 from properties        where delegation_id = west)
       and not exists (select 1 from support_cases     where delegation_id = west)
       and not exists (select 1 from case_studies      where delegation_id = west)
       and not exists (select 1 from imadas            where delegation_id = west)
       and not exists (select 1 from zones             where delegation_id = west)
       and not exists (select 1 from intervenants      where delegation_id = west)
       and not exists (select 1 from intervenant_zones where delegation_id = west)
       and not exists (select 1 from manufacturers     where delegation_id = west)
       and not exists (select 1 from portfolio_items   where delegation_id = west)
    then
      delete from delegations where id = west;
    else
      raise notice 'صفاقس الغربية (%) ما زالت لها مراجع إلى جانب صفاقس الشمالية (%) — لم تُحذف', west, north;
    end if;
  end if;
end $$;
