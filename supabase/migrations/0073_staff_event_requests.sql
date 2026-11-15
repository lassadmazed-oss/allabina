-- ============================================================
-- 0073_staff_event_requests.sql · السجلّ يقبل تحيين معطى في ملفّ
-- ============================================================
-- نفس علّة 0059: القيد لا يعرف إلّا أحداث الحسابات وتبديل الإعدادات،
-- والاستدعاء يبتلع الخطأ بـ`.then(({ error }) => error && warn)`.
-- فتثبيت المساحة من «ملفّ المطلب» كان يُكتب 'requests.update' فيُرفض،
-- وتنجح الدالّة ولا يبقى أثر لمن ثبّت ولا متى.
--
-- والفرق عن request_events: ذاك سجلّ الملفّ كما يراه الفريق في تاريخه،
-- وهذا سجلّ من فعل ماذا — القسم 08: «المستخدم والوقت والحدث».
-- ============================================================

alter table staff_events drop constraint if exists staff_events_event_type_check;
alter table staff_events add constraint staff_events_event_type_check check (
  event_type = any (array[
    'login', 'login_failed', 'login_denied', 'logout',
    'member_created', 'role_changed', 'activated', 'deactivated',
    'password_set', 'password_changed', 'member_removed',
    -- تبديل إعداد مرجعي: أوزان، أسعار بنوك، اتّصال، هويّة، كاتالوج، استيراد
    'settings.update',
    -- تحيين معطى داخل ملفّ مطلب: المساحة المتثبَّت فيها وما شابهها
    'requests.update'
  ])
);
