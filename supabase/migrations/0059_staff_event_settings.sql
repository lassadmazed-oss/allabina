-- ============================================================
-- سجلّ الفريق كان يرفض «تبديل إعداد» بصمت
-- ============================================================
-- قيد staff_events.event_type لا يعرف إلّا أحداث الحسابات (دخول،
-- إنشاء عضو، تبديل دور…). وكلّ شفرة تسجّل تبديل إعداد تكتب
-- 'settings.update' — فيرفضها القيد، والاستدعاء يبتلع الخطأ بـ
-- `.then(({ error }) => error && console.warn(...))`.
--
-- النتيجة: من 14/11/2026 إلى الوراء، لا أثر في السجلّ لتبديل سعر بنك
-- ولا أوزان دراسة ولا رقم هاتف المنصّة ولا نشر لوط في الكاتالوج. ولا
-- رسالة خطأ ولا سطر أحمر — الدالّة تنجح والسطر لا يُكتب.
--
-- والقسم 08 من الكرّاس يشترط «سجل غير قابل للتعديل العادي: المستخدم
-- والوقت والحدث والنسخة والقرار». سجلّ لا يسجّل ليس سجلّاً.
alter table staff_events drop constraint if exists staff_events_event_type_check;
alter table staff_events add constraint staff_events_event_type_check check (
  event_type = any (array[
    'login', 'login_failed', 'login_denied', 'logout',
    'member_created', 'role_changed', 'activated', 'deactivated',
    'password_set', 'password_changed', 'member_removed',
    -- تبديل إعداد مرجعي: أوزان، أسعار بنوك، اتّصال، هويّة، كاتالوج، استيراد
    'settings.update'
  ])
);

comment on constraint staff_events_event_type_check on staff_events is
  'أيّ نوع حدث جديد يُضاف هنا أوّلاً، وإلّا يُرفض السطر بصمت ويضيع الأثر.';
