-- ============================================================
-- 0070_report_internal_notes.sql · ملاحظات داخلية ومعطى مُتثبَّت منه
-- ============================================================
-- ماكيت اللوحة (B03): «Notes internes confidentielles — visibles
-- uniquement par l'équipe AL-LUBNA (non incluses dans la version
-- client)». وهي ليست خانةً زائدة: اليوم يكتب chef de projet كلّ شيء
-- في «ما تعملش» لأنّه لا يجد أين يكتب «نتفاهم مع المناول على الرزنامة»،
-- فيصل ذلك إلى الحريف.
--
-- و(B02): «Budget déclaré — déclaré par le client» مقابل «Surface
-- (technique vérifiée) — à confirmer». القسم 10 يطلب الفصل:
-- «التفريق بين بيانات الحريف والبيانات التي تثبّت منها الفريق».
-- فالمساحة التي يصرّح بها الحريف ليست المساحة التي يقيسها الفريق،
-- وبناء عرضٍ على الأولى بناءٌ على كلام.
-- ============================================================

alter table site_reports
  add column if not exists internal_note text;

comment on column site_reports.internal_note is
  'ملاحظات داخلية — لا تخرج للحريف أبداً، لا في لوحته ولا في نسخة التقرير.';

alter table housing_requests
  add column if not exists verified_area_m2 numeric(10, 2),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references staff (user_id) on delete set null;

comment on column housing_requests.desired_area_m2 is
  'المساحة كما صرّح بها الحريف. لا يُبنى عليها عرض نهائي.';
comment on column housing_requests.verified_area_m2 is
  'المساحة بعد تثبّت الفريق. فارغة = ما زال ما تثبّتناش.';
