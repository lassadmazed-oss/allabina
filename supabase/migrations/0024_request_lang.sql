-- ============================================================
-- 0024_request_lang.sql · لغة الحريف
-- ============================================================
-- الرسائل القصيرة تُرسل بلغة الحريف، والاستمارة كانت تعرف لغته وقت
-- الإرسال ثمّ تنساها. الآن تُحفظ مع المطلب: من سجّل بالفرنسية يتلقّى
-- الفرنسية في كلّ رسالة لاحقة، لا في الأولى فقط.
-- ============================================================

alter table housing_requests add column if not exists lang text not null default 'ar'
  check (lang in ('ar', 'fr'));

alter table properties add column if not exists lang text not null default 'ar'
  check (lang in ('ar', 'fr'));

comment on column housing_requests.lang is 'لغة الحريف وقت التسجيل — تُستعمل في الرسائل القصيرة والمراسلات';
