-- ============================================================
-- العروض (views) تتجاوز RLS — هذا الملفّ يسدّ الثقب
-- ============================================================
-- العرض في Postgres يُنفَّذ بصلاحيات مُنشئه لا بصلاحيات قارئه، فسياسات
-- RLS على الجدول الأمّ لا تُطبَّق عند القراءة من العرض. النتيجة قِيست
-- بالمفتاح العمومي قبل هذه الهجرة:
--
--   request_priority        → 53  سطراً: ref_code + full_name + status
--   request_document_status → 137 سطراً: أيّ وثيقة ناقصة لأيّ ملفّ
--   support_inbox           → 5   أسطر:  full_name + phone + problem_note
--   standing_share_totals   → 5   أسطر:  أسعار المتر لكلّ مستوى تشطيب
--   property_stats          → 1   سطراً: أعداد العقارات بحالاتها
--
-- والمفتاح العمومي يُرسَل إلى متصفّح كلّ زائر — فهذه معطيات كانت مفتوحة
-- لمن يقرأ شفرة الصفحة. أخطرها support_inbox: هواتف عائلات في وضع هشّ.
--
-- الدواء طبقتان:
--   1) security_invoker = on  → العرض يُقرأ بصلاحيات قارئه، فسياسات
--      is_staff() على الجدول الأمّ تشتغل. الفريق يقرأ، وغيره لا.
--   2) revoke ... from anon   → حتّى الوصول للعرض يُمنع على غير المسجَّل،
--      فلا يبقى الأمر معلّقاً على صحّة سياسة واحدة.
--
-- `authenticated` تبقى لها الصلاحية: الفريق مسجَّل بهذا الدور، و(1) هي
-- التي تفصل الموظّف من غيره. و`service_role` (المفتاح السرّي في الخادم)
-- يتجاوز RLS أصلاً، فقراءات الـBack-office ما تتأثّرش.
--
-- الثلاثة الباقية تبقى مفتوحة بنيّة مبيّتة — أعداد مجرّدة بلا أيّ معطى
-- شخصي، وهي أساس الصفحات العمومية: public_request_stats و
-- delegation_activity و support_case_public (هذا الأخير يرشّح بنفسه
-- `published and closed_at is null`).
-- ============================================================

do $$
declare
  v text;
  private_views text[] := array[
    'request_priority',
    'request_document_status',
    'support_inbox',
    'property_stats',
    'standing_share_totals'
  ];
begin
  foreach v in array private_views
  loop
    if to_regclass('public.' || v) is null then
      raise notice 'العرض % غير موجود — تخطّي', v;
      continue;
    end if;
    execute format('alter view %I set (security_invoker = on)', v);
    execute format('revoke all on %I from anon', v);
  end loop;
end $$;

comment on view request_priority is
  'ترتيب الملفّات حسب الاستعجال ثمّ الأقدمية — مدخل قائمة عمل المستشار. '
  'security_invoker: يُقرأ بصلاحيات القارئ، وممنوع على anon.';

comment on view support_inbox is
  'قائمة عمل المساندة — تحمل الاسم والهاتف وسرد المشكل. '
  'security_invoker: يُقرأ بصلاحيات القارئ، وممنوع على anon.';
