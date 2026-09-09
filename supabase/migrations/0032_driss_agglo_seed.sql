-- ============================================================
-- 0032_driss_agglo_seed.sql · الأرقام من الوثائق لا من التقدير
-- ============================================================
-- كلّ سطر هنا مأخوذ من Avis Technique مذكور بمرجعه. لا رقم بلا وثيقة:
-- هذا هو الفرق بين Devis يُدافَع عنه أمام بنك وDevis يُناقَش.
-- ============================================================

-- الحدود التي تسري في النظام — تُقرأ برمجياً لا تُعرض كنصّ
alter table construction_systems add column if not exists constraints jsonb not null default '{}'::jsonb;

update construction_systems set constraints = jsonb_build_object(
  'fire_resistance_hours', 1,
  'fire_reaction_class', 'A1',
  'load_bearing_series_cm', jsonb_build_array(20, 22, 25),
  'partition_series_cm', jsonb_build_array(10, 15),
  'excluded_uses', jsonb_build_array('sous_sol_parking'),
  'excluded_reason_ar', 'مقاومة الحريق المطلوبة أعلى من ساعة واحدة — يلزم نظام آخر',
  'wind_check', 'case_by_case',
  'raidisseur_spacing_m', 2.5,
  'enduit_exterieur_mm', 15,
  'standards', jsonb_build_array('DTU 20.1', 'DTU 26.1')
) where code = 'BLOC_PPE';

-- ---------- الوثائق ----------
insert into offering_documents (offering_id, doc_kind, ref_code, title, issued_on, is_normative)
select o.id, 'avis_technique', d.ref, d.title, d.issued, true
from (values
  ('mur',      'DRISS AGGLO-02-OMB/2023', 'Avis Technique — Blocs en béton (ouvrages de maçonnerie)', date '2023-01-01'),
  ('plancher', 'DRISS AGGLO-01-PPE/2023', 'Avis Technique — Planchers à poutrelles et entrevous',     date '2023-01-01'),
  ('cloture',  'DRISS AGGLO-3-MCT/2023',  'Avis Technique — Mur de clôture',                          date '2023-01-01')
) as d(scope, ref, title, issued)
join system_offerings o
  on o.manufacturer_code = 'DRISS' and o.element_scope = d.scope
where not exists (select 1 from offering_documents x where x.ref_code = d.ref);

-- ---------- كتالوج البلوك ----------
-- قاعدة التسمية: الرقمان بعد BC سماكة البلوك، وما بعدهما وصف مكمّل.
insert into system_components
  (offering_id, ref_fabricant, name_ar, usage_domain, length_mm, width_mm, height_mm, role_ar, is_load_bearing, document_id, sort_order)
select o.id, c.ref, c.name_ar, 'mur', c.l, c.w, c.h, c.role, c.bearing, doc.id, c.ord
from (values
  ('BC10-3N',  'بلوك 10 — 3 نوى',      500, 100, 200, '3 نوى — قواطع',                     false,  1),
  ('BC15-8N',  'بلوك 15 — 8 نوى نصفي', 500, 150, 200, '8 نوى، نصفي — قواطع',               false,  2),
  ('BC20-6N',  'بلوك 20 — 6 نوى',      500, 200, 200, '6 نوى — بلوك عادي حامل',            true,   3),
  ('BC20-6NR', 'بلوك 20 — عمود دائري', 500, 200, 200, 'عمود دائري R 8 صم',                 true,   4),
  ('BC20-8N',  'بلوك 20 — 8 نوى نصفي', 500, 200, 200, '8 نوى، نصفي',                       true,   5),
  ('BC20-8ND', 'بلوك 20 — قابل للتقسيم', 500, 200, 200, 'قابل للتقسيم — divisible',        true,   6),
  ('BC20-8NR', 'بلوك 20 — عمود دائري', 500, 200, 200, 'عمود دائري R 8 صم',                 true,   7),
  ('BC20-8NC', 'بلوك 20 — عمود مربّع',  500, 200, 200, 'عمود مربّع A 12 صم',                true,   8),
  ('BC22-9N',  'بلوك 22 — 9 نوى',      500, 220, 200, '9 نوى',                             true,   9),
  ('BC22-9NC', 'بلوك 22 — عمود مربّع',  500, 220, 200, 'عمود مربّع A 12 صم',                true,  10),
  ('BC25-9N',  'بلوك 25 — 9 نوى',      500, 250, 200, '9 نوى',                             true,  11),
  ('BC25-9NC', 'بلوك 25 — عمود مربّع',  500, 250, 200, 'عمود مربّع A 13 صم',                true,  12),
  ('BC20-FU',  'بلوك ربط على شكل U',   500, 200, 190, 'مقطعه 14×17 صم — للعتبات (linteaux)، يُملأ جوفه بخرسانة الربط مع حديد التقوية', true, 13),
  ('BC20-FH',  'بلوك تشكيل على شكل H', 500, 200, 200, 'ثلاثة تجاويف بسماكة 3 صم — لإدخال الحديد الرأسي والأفقي، وتُملأ بالخرسانة فتكوّن ما يشبه جداراً مسلّحاً', true, 14),
  ('BC20-CS',  'بلوك 20 — ارتفاع 25',  500, 200, 250, 'ارتفاع 25 صم',                      true,  15)
) as c(ref, name_ar, l, w, h, role, bearing, ord)
cross join lateral (
  select id from system_offerings where manufacturer_code = 'DRISS' and element_scope = 'mur'
) o
left join offering_documents doc on doc.ref_code = 'DRISS AGGLO-02-OMB/2023'
on conflict (offering_id, ref_fabricant) do nothing;

-- ---------- كتالوج السقف ----------
-- Entrevous 52×20×h · Poutrelles: الرقمان بعد P ارتفاعها والرقمان بعدهما طولها ÷ 10.
insert into system_components
  (offering_id, ref_fabricant, name_ar, usage_domain, length_mm, width_mm, height_mm, role_ar, document_id, sort_order)
select o.id, c.ref, c.name_ar, 'plancher', c.l, c.w, c.h, c.role, doc.id, c.ord
from (values
  ('E07',    'Entrevous 7 مصمت',  520, 200,  70, 'مصمت plein — ثقل موازن جانب الشرفات واستعمالات خاصّة',  1),
  ('E12',    'Entrevous 12',      520, 200, 120, 'entrevous لسقف 12+4',                                   2),
  ('E15',    'Entrevous 15',      520, 200, 150, 'entrevous لسقف 15+5',                                   3),
  ('E20',    'Entrevous 20',      520, 200, 200, 'entrevous لسقف 20+6',                                   4),
  ('P12-35', 'Poutrelle 12 — 3,50 م', 3500, null, 120, 'ارتفاع 12 صم · بحر 3,50 م',                       5),
  ('P15-42', 'Poutrelle 15 — 4,20 م', 4200, null, 150, 'ارتفاع 15 صم · بحر 4,20 م',                       6),
  ('P20-48', 'Poutrelle 20 — 4,80 م', 4800, null, 200, 'ارتفاع 20 صم · بحر 4,80 م',                       7),
  ('TSP',    'Treillis soudé plan',   null, null, null, 'شبكة تسليح لبلاطة الضغط (dalle de compression)',  8)
) as c(ref, name_ar, l, w, h, role, ord)
cross join lateral (
  select id from system_offerings where manufacturer_code = 'DRISS' and element_scope = 'plancher'
) o
left join offering_documents doc on doc.ref_code = 'DRISS AGGLO-01-PPE/2023'
on conflict (offering_id, ref_fabricant) do nothing;

-- ---------- كتالوج السور ----------
insert into system_components
  (offering_id, ref_fabricant, name_ar, usage_domain, length_mm, width_mm, height_mm, role_ar, document_id, sort_order)
select o.id, c.ref, c.name_ar, 'cloture', c.l, c.w, c.h, c.role, doc.id, c.ord
from (values
  ('BC20-6N',  'بلوك 20 — 6 نوى',        500, 200, 200, 'جسم السور',                                       1),
  ('BC20-6NR', 'بلوك 20 — عمود دائري',   500, 200, 200, 'يُركَّب فوق بعضه فيشكّل عموداً يُصبّ في الموقع لكلّ trame', 2),
  ('BC20-FU',  'بلوك ربط على شكل U',     500, 200, 190, 'chaînage أفقي',                                   3),
  ('BC20-FH',  'بلوك تشكيل على شكل H',   500, 200, 200, 'حديد رأسي وأفقي',                                 4),
  ('PO10-AT',  'Poutrelle 10',           null, null, 100, '2T10 أسفل · T6 أعلى · zig-zag من D5 بتباعد 20 صم', 5)
) as c(ref, name_ar, l, w, h, role, ord)
cross join lateral (
  select id from system_offerings where manufacturer_code = 'DRISS' and element_scope = 'cloture'
) o
left join offering_documents doc on doc.ref_code = 'DRISS AGGLO-3-MCT/2023'
on conflict (offering_id, ref_fabricant) do nothing;

-- ---------- الكمّيات: مصدرها الوثيقة لا اجتهادنا ----------
insert into offering_quantity_rules (offering_id, document_id, rule_key, variant, value, unit_ar, condition_ar)
select o.id, doc.id, q.k, q.variant, q.val, q.unit, q.cond
from (values
  ('units_per_m2',  '20', 10.0, 'وحدة / م²', null),
  ('units_per_m2',  '22', 10.0, 'وحدة / م²', null),
  ('units_per_m2',  '25', 10.0, 'وحدة / م²', null),
  ('mortar_l_per_m2', '20', 25.0, 'لتر / م²', 'مفاصل بسماكة 15 مم'),
  ('mortar_l_per_m2', '22', 30.0, 'لتر / م²', 'مفاصل بسماكة 15 مم'),
  ('mortar_l_per_m2', '25', 35.0, 'لتر / م²', 'مفاصل بسماكة 15 مم')
) as q(k, variant, val, unit, cond)
cross join lateral (
  select id from system_offerings where manufacturer_code = 'DRISS' and element_scope = 'mur'
) o
join offering_documents doc on doc.ref_code = 'DRISS AGGLO-02-OMB/2023'
on conflict (offering_id, rule_key, variant) do nothing;

insert into offering_quantity_rules (offering_id, document_id, rule_key, variant, value, unit_ar, condition_ar)
select o.id, doc.id, 'entraxe_cm', null, 60, 'صم', 'تباعد محاور الـpoutrelles'
from system_offerings o
join offering_documents doc on doc.ref_code = 'DRISS AGGLO-01-PPE/2023'
where o.manufacturer_code = 'DRISS' and o.element_scope = 'plancher'
on conflict (offering_id, rule_key, variant) do nothing;

-- ---------- البحور القصوى — الجدول الذي يمنع الآلة من اختيار السقف ----------
-- تسليح 2HA12. غرفة ببحر 4,50 م تتجاوز حدّ 15+5 فتستوجب 20+6.
insert into span_limits
  (offering_id, document_id, usage_code, usage_ar, load_kn_m2, assembly_code, span_max_m, reinforcement)
select o.id, doc.id, s.code, s.ar, s.q, s.asm, s.span, '2HA12'
from (values
  ('terrasse_nue', 'سطح بلا تغطية', 1.0, '12+4', 4.30),
  ('terrasse_nue', 'سطح بلا تغطية', 1.0, '15+5', 5.10),
  ('terrasse_nue', 'سطح بلا تغطية', 1.0, '20+6', 6.00),
  ('terrasse',     'سطح',           1.0, '12+4', 3.80),
  ('terrasse',     'سطح',           1.0, '15+5', 4.50),
  ('terrasse',     'سطح',           1.0, '20+6', 5.20),
  ('habitation',   'سكن',           1.5, '12+4', 3.50),
  ('habitation',   'سكن',           1.5, '15+5', 4.20),
  ('habitation',   'سكن',           1.5, '20+6', 4.80),
  ('bureaux',      'مكاتب',         2.5, '12+4', 3.30),
  ('bureaux',      'مكاتب',         2.5, '15+5', 4.00),
  ('bureaux',      'مكاتب',         2.5, '20+6', 4.60),
  ('commerce',     'محلّات تجارية',  5.0, '12+4', 3.00),
  ('commerce',     'محلّات تجارية',  5.0, '15+5', 3.60),
  ('commerce',     'محلّات تجارية',  5.0, '20+6', 4.10)
) as s(code, ar, q, asm, span)
cross join lateral (
  select id from system_offerings where manufacturer_code = 'DRISS' and element_scope = 'plancher'
) o
join offering_documents doc on doc.ref_code = 'DRISS AGGLO-01-PPE/2023'
on conflict (offering_id, usage_code, assembly_code) do nothing;
