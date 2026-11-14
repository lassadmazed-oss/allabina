-- ============================================================
-- 0066_hvac_products.sql · المكيّفات
-- ============================================================
-- بعد البحث في صنفي البيبان والزليج، بان فرقٌ يقسم الكاتالوج كلّه:
--
--   المقال الذي هو **جهاز** — مكيّف، شفّاط، سخّان — له على الويب
--   التونسي مرجعٌ ومواصفاتٌ وسعرٌ وصورة. يُباع كما يُباع التلفاز.
--
--   والمقال الذي هو **مادّة سائبة** — سيمان، حديد، زليج، بيبان — لا
--   شيء منه منشور. يُباع في المعرض والديبو بالديڤي.
--
-- فهذه بذرة الصنف الأوّل. وما بقي يُدخَل من «زيد منتَج» في اللوحة بعد
-- زيارة ديبو، لا من موقع يُقرأ.
--
-- ⚠ وكالعادة: أسعار بائع (spacenet.tn) قُرئت يوم 14 نوفمبر 2026 مع
--   روابطها. price_verified = false وis_public = false — ومقاولٌ
--   يشتري عشرة مكيّفات لا يدفع سعر من يشتري واحداً.
--
-- والتغطية هنا **واقعة لا تقدير**: وحدة المقال «u»، والمكيّف جهاز
--   واحد. عبوة واحدة تغطّي وحدةً واحدة = 1.
-- ============================================================

insert into manufacturers (code, name_ar, name_fr, is_active) values
  ('TCL',     'TCL',     'TCL',     true),
  ('GREE',    'ڤري',     'Gree',    true),
  ('TORNADO', 'تورنادو', 'Tornado', true)
on conflict (code) do nothing;

insert into products
  (code, manufacturer_code, brand, range_name, name_ar, name_fr,
   pack_size, pack_unit, price, price_includes_tax, price_source, price_checked_at, specs)
values
  ('TH-C12BEE', 'TORNADO', 'Tornado', null,
   'مكيّف تورنادو 12000 وحدة — بارد', 'Climatiseur Tornado TH-C12BEE 12000 BTU Froid',
   1, 'u', 1299.000, true,
   'https://spacenet.tn/climatiseur-tunisie-chaud-froid/96554-climatiseur-tornado-th-c12bee-12000-btu-froid-blanc.html',
   date '2026-11-14',
   '{"القدرة":"12000 وحدة","النمط":"بارد برك","المناخ":"مدارية T3","الغاز":"R32","مزايا":"تورپو · ليلي · نزع الرطوبة · إرجاع تلقائي بعد القطع","الفلتر":"يتغسّل","الضمان":"3 سنين · 5 على الموتور"}'::jsonb),

  ('TAC-12CHSA', 'TCL', 'TCL', 'TPG11I',
   'مكيّف TCL 12000 وحدة — إنفرتر بارد وسخون', 'Climatiseur TCL TPG11I 12000 BTU Inverter Chaud Froid',
   1, 'u', 1559.000, true,
   'https://spacenet.tn/climatiseur-tunisie-chaud-froid/86293-climatiseur-tcl-tpg11i-12000-btu-inverter-chaud-froid-blanc.html',
   date '2026-11-14',
   '{"القدرة":"12000 وحدة","النمط":"بارد وسخون · إنفرتر","المناخ":"مدارية T3","الغاز":"R410a","المساحة المناسبة":"15 إلى 23 م²","الضجيج الخارجي":"50 ديسيبل","التيّار":"220-240 فولط","الاقتصاد":"حتّى 60% في الكهرباء"}'::jsonb),

  ('CL12AWBXB-K6DNA1H', 'GREE', 'Gree', null,
   'مكيّف ڤري 12000 وحدة — إنفرتر مداري ذكي', 'Climatiseur Gree 12000 BTU Inverter Tropicalisé Smart',
   1, 'u', 1599.000, true,
   'https://spacenet.tn/climatiseur-tunisie-chaud-froid/99129-climatiseur-gree-12000-btu-inverter-tropicalise-smart-chaud-froid-blanc.html',
   date '2026-11-14',
   '{"القدرة":"12000 وحدة","النمط":"بارد وسخون · إنفرتر","المناخ":"مدارية T3 — يخدم في 50 درجة","الغاز":"R32 إيكولوجي","السرعات":"7","مدى الهواء":"12 متر","التحكّم":"واي-فاي","مزايا":"تبريد في 30 ثانية · تنظيف تلقائي · هادي","الضمان":"3 سنين"}'::jsonb)
on conflict (code) do nothing;

-- الربط بمقال «مكيّفات» في كلّ مستوياته، والتغطية 1: وحدة المقال
-- قطعة، والمكيّف قطعة.
insert into article_products (article_id, product_id, coverage_per_pack, coverage_note, sort_order)
select a.id, p.id, 1, 'جهاز واحد لكلّ وحدة.', 0
from articles a
cross join products p
where a.code like 'CL-02-%'
  and p.code in ('TH-C12BEE', 'TAC-12CHSA', 'CL12AWBXB-K6DNA1H')
on conflict do nothing;

-- الأرخص افتراضياً حتّى يقرّر الفريق غيره
update article_products ap
set is_default = true
from products p, articles a
where ap.product_id = p.id and ap.article_id = a.id
  and p.code = 'TH-C12BEE' and a.code like 'CL-02-%'
  and not exists (
    select 1 from article_products x where x.article_id = ap.article_id and x.is_default
  );
