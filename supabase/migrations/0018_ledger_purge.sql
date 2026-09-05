-- ============================================================
-- 0018_ledger_purge.sql · مخرج واحد صريح من دفتر الشفافية
-- ============================================================
-- دفتر الشفافية سجلّ إضافي: مُطلِق يرفض كلّ update و delete. هذا صحيح
-- في وجه التحريف، لكنّه كان يمنع حالتين مشروعتين:
--
--   1. محو معطيات بطلب صاحبها. القانون 63 لسنة 2004 يعطي الحقّ في
--      المحو، ومُطلِق يرفض الحذف دائماً يجعل المنصّة عاجزة عن تنفيذه.
--   2. حذف مطلب فيه قيود — حتى الحذف المتتالي كان يُرفض.
--
-- الحلّ ليس تخفيف الحراسة، بل مخرج واحد يُفتح صراحةً:
--
--   begin;
--     set local allabina.ledger_purge = 'on';
--     delete from housing_requests where id = '…';
--   commit;
--
-- المخرج يسمح بالحذف فقط، لا بالتعديل: قيد لا يُصحَّح أبداً بتحريفه،
-- والتصحيح يبقى بقيد جديد. والفتح صريح داخل معاملة واحدة، فلا يمكن
-- أن يحدث سهواً من الواجهة.
-- ============================================================

create or replace function support_ledger_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('allabina.ledger_purge', true), '') = 'on' then
    return old;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'دفتر الشفافية سجلّ إضافي: الحذف يستوجب فتح allabina.ledger_purge صراحةً';
  end if;

  raise exception 'دفتر الشفافية سجلّ إضافي: التصحيح يكون بقيد جديد، لا بتعديل';
end $$;

comment on function support_ledger_append_only() is
  'يمنع تعديل الدفتر دائماً، ويمنع الحذف إلا بفتح allabina.ledger_purge داخل معاملة';
