-- ============================================================
-- 0071_publication.sql · نشر المشروع بموافقتين
-- ============================================================
-- ورقة اللوحة (B04): «Projet privé par défaut · Accord du client:
-- requis · Validation direction: requise · Publication bloquée sans
-- les deux accords». وورقة الواجهة (F04): «Gérer mon accord de
-- publication».
--
-- والقسم 09 من الملخّص: المشروع خاصّ افتراضياً، ولا يُنشر إلّا
-- بموافقة واضحة من الحريف ومراجعة الإدارة، ومع إمكان إيقاف النشر
-- لاحقاً.
--
-- فالشرط في القاعدة لا في الشاشة: شاشةٌ تُنسى، وزرٌّ يُضاف غداً في
-- مكانٍ آخر ينشر بلا أن يمرّ على الفحص. وسحبُ الحريف لموافقته يُنزل
-- النشر وحده — القيد يرفض السطر، لا ينتظر من يتذكّر.
-- ============================================================

alter table chantiers
  add column if not exists client_consent_at   timestamptz,
  add column if not exists client_consent_by   uuid references app_users (id) on delete set null,
  add column if not exists publish_approved_at timestamptz,
  add column if not exists publish_approved_by uuid references staff (user_id) on delete set null,
  add column if not exists is_public           boolean not null default false,
  add column if not exists public_title        text,
  add column if not exists public_summary      text;

-- لا نشر بلا الموافقتين. القيد يحرس كلّ باب، الموجود منها والآتي.
alter table chantiers drop constraint if exists chantiers_publish_needs_both;
alter table chantiers add constraint chantiers_publish_needs_both check (
  not is_public
  or (client_consent_at is not null and publish_approved_at is not null)
);

create index if not exists chantiers_public_idx on chantiers (is_public) where is_public;

comment on column chantiers.client_consent_at is
  'موافقة الحريف على النشر. سحبها يُنزل النشر — القيد يرفض بقاءه.';
comment on column chantiers.publish_approved_at is
  'اعتماد الإدارة للنشر. مستقلّ عن موافقة الحريف، وكلاهما شرط.';
comment on column chantiers.public_summary is
  'ما يُعرض للعموم. لا عنوان دقيق ولا وثائق ولا مبالغ — القسم 09.';
