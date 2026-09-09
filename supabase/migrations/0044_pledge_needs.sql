-- ============================================================
-- 0044_pledge_needs.sql · التعهّد يسمّي الحاجة التي يقصدها
-- ============================================================
-- المساهم كان يكتب «50 كيس إسمنت» في خانة حرّة، والفريق يخمّن أيّ حاجة
-- من حاجيات الحالة يقصد. الآن يختار من حاجيات الحالة المفتوحة نفسها —
-- سطور support_ledger بحدث needed — وتُحفظ معرّفاتها مع التعهّد.
--
-- label تبقى: نصّ مقروء يجمع ما اختاره وما زاده بيده، للتوافق مع شاشة
-- الفريق ومع التعهّدات القديمة.
-- ============================================================

alter table support_pledges add column if not exists need_ids bigint[];

comment on column support_pledges.need_ids is
  'معرّفات سطور support_ledger (event = needed) التي يستهدفها التعهّد';

create index if not exists support_pledges_need_ids_idx on support_pledges using gin (need_ids);
