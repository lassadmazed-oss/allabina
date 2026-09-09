-- ============================================================
-- 0036_project_extras.sql · زيادات المشروع — ما ينقص المواصفات
-- ============================================================
-- «زيادات» كانت ثلاثاً: جراج · تراس · حديقة. وهي أقلّ ممّا يطلبه الناس
-- في صفاقس فعلاً، فيبقى ما ينقص خارج العرض التقديري — والعرض الذي لا
-- يذكر السور ولا الماجل يُقرأ رخيصاً ثمّ يُصحَّح في المكالمة.
--
-- الأعمدة صريحة لا مصفوفة: كلّ واحد منها **متغيّر في صيغ البوردرو**
-- (`qty_formula`)، والصيغة تحتاج اسماً تعرفه لا مفتاحاً داخل مصفوفة.
--
-- والسور تحديداً يصل الفصل الثاني عشر بهذا: عرض `cloture` من Driss Agglo
-- مبذور بعناصره، وينقصه أن يُطلَب من المواطن أصلاً.
-- ============================================================

alter table project_configs add column if not exists cloture   boolean not null default false;
alter table project_configs add column if not exists majel     boolean not null default false;
alter table project_configs add column if not exists piscine   boolean not null default false;
alter table project_configs add column if not exists annexe    boolean not null default false;
alter table project_configs add column if not exists solar     boolean not null default false;
alter table project_configs add column if not exists ascenseur boolean not null default false;

comment on column project_configs.cloture   is 'سور الأرض — يقابل عرض cloture في نظام البناء';
comment on column project_configs.majel     is 'ماجل لتجميع ماء المطر — شائع في صفاقس ونادراً ما يُسأل عنه';
comment on column project_configs.piscine   is 'مسبح';
comment on column project_configs.annexe    is 'بيت خارجي أو ملحق مستقلّ';
comment on column project_configs.solar     is 'ألواح شمسية';
comment on column project_configs.ascenseur is 'مصعد — لا يُعرض إلّا من طابقين فما فوق';
