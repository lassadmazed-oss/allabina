-- =====================================================================
-- 0029 — ما يصرّح به صاحب المطلب مقابل ما تثبّت منه الإدارة
--
-- «الوثائق المتوفّرة» كانت خانة واحدة يؤشّرها المستشار. لكنّ «الحريف
-- قال عندو رسم عقاري» و«الرسم العقاري وصلنا وشفناه» ليسا نفس الشيء،
-- وخلطهما يجعل قائمة الوثائق غير صالحة للاعتماد عليها.
--
-- declared = صرّح بها صاحب المطلب في الاستمارة.
-- available = الفريق تثبّت منها. الأولى لا تُغيّر الثانية أبداً.
-- =====================================================================

alter table request_documents
  add column if not exists declared boolean not null default false;

alter table request_documents
  add column if not exists declared_at timestamptz;

comment on column request_documents.declared is
  'صرّح بها صاحب المطلب — ليست تثبّتاً. التثبّت في available.';
