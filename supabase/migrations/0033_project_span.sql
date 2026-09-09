-- ============================================================
-- 0033_project_span.sql · البحر الأقصى في المشروع
-- ============================================================
-- تركيبة السقف لا تُشتقّ من المساحة: تُشتقّ من **البحر** والاستعمال.
-- 120 م² قد تكون غرفاً ببحر 3,20 م وقد تكون قاعة ببحر 5 م — والفرق
-- بينهما هو الفرق بين سقف داخل حدوده وسقف خارجها.
--
-- بلا هذا العمود يبقى تحذير «التركيبة تتجاوز الحدّ» مستحيلاً: ما من رقم
-- يُقارَن بجدول البحور.
-- ============================================================

alter table project_configs add column if not exists max_span_m numeric(5,2);
alter table project_configs add column if not exists floor_usage_code text;

comment on column project_configs.max_span_m is
  'أكبر بحر حرّ في المشروع بالمتر — يُقارَن بجدول span_limits';
comment on column project_configs.floor_usage_code is
  'استعمال السقف المرجعي (habitation · bureaux · commerce · terrasse)';
