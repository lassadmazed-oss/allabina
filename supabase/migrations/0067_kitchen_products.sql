-- ============================================================
-- 0067_kitchen_products.sql · الشفّاط وحوض المطبخ
-- ============================================================
-- تكملة لصنف «الأجهزة»: ما يُباع في تونس بمرجع ومواصفات وسعر على
-- الويب. ثلاثة شفّاطات وثلاثة أحواض، من بائعين اثنين لا واحد
-- (spacenet.tn وtunisianet.com.tn) — كلّ سطر برابطه وتاريخه.
--
-- ⚠ أسعار بائعٍ للمفرّق، قُرئت يوم 14 نوفمبر 2026.
--   price_verified = false وis_public = false.
--
-- والتغطية واقعة: وحدة المقال قطعة، والجهاز قطعة ← 1.
-- ============================================================

insert into manufacturers (code, name_ar, name_fr, is_active) values
  ('CONDOR',  'كوندور',       'Condor',        true),
  ('FOCUS',   'فوكس',         'Focus',         true),
  ('ARTMAR',  'أرثر مارتن',   'Arthur Martin', true),
  ('INFINITY','إنفينيتي',     'Infinity',      true)
on conflict (code) do nothing;

-- ---------- الشفّاطات ----------
insert into products
  (code, manufacturer_code, brand, range_name, name_ar, name_fr,
   pack_size, pack_unit, price, price_includes_tax, price_source, price_checked_at, specs)
values
  ('CH-Q6300X', 'CONDOR', 'Condor', null,
   'شفّاط كوندور 60 صم — إينوكس', 'Hotte Casquette Condor 60 cm Inox',
   1, 'u', 219.000, true,
   'https://www.tunisianet.com.tn/hotte-aspirante-tunisie/93144-hotte-casquette-condor-60cm-inox-.html',
   date '2026-11-14',
   '{"العرض":"60 صم","قوّة الشفط":"320 م³/س","الموتور":"123 واط","السرعات":"3","الفلاتر":"فحم 1 · ألمنيوم 2","المقاسات":"600×155×489 مم","اللون":"إينوكس","الضمان":"سنتين"}'::jsonb),

  ('F.605X', 'FOCUS', 'Focus', 'Pyramidale',
   'شفّاط فوكس هرمي 60 صم — إينوكس', 'Hotte Pyramidale Focus 60 cm Inox F.605X',
   1, 'u', 289.000, true,
   'https://spacenet.tn/hotte/39988-hotte-pyramidale-focus-60-cm-inox-f605x-.html',
   date '2026-11-14',
   '{"العرض":"60 صم","قوّة الشفط":"600 م³/س","السرعات":"3","الإنارة":"لمبة 28 واط","الفلاتر":"ألمنيوم يتغسّل · فحم ضدّ الريحة","الصنف الطاقي":"A","قطر المخرج":"150 مم","الضمان":"سنتين"}'::jsonb),

  ('AMHD60B', 'ARTMAR', 'Arthur Martin', null,
   'شفّاط أرثر مارتن 60 صم — أسود', 'Hotte Décorative Arthur Martin 60 cm Noir',
   1, 'u', 539.000, true,
   'https://www.tunisianet.com.tn/hotte-aspirante-tunisie/83900-hotte-aspirante-decorative-arthur-martin-60-cm-noir-amhd60b.html',
   date '2026-11-14',
   '{"العرض":"60 صم","النوع":"ديكوراتيف","اللون":"أسود"}'::jsonb),

-- ---------- أحواض المطبخ ----------
  ('SMART-86', 'INFINITY', 'Infinity', '86 Smart',
   'حوض مطبخ إنفينيتي 86 سمارت — حوض واحد', 'Évier Infinity 86 Smart 1 Bac 50 cm Inox',
   1, 'u', 229.000, true,
   'https://spacenet.tn/cuisine/101763-evier-de-cuisine-infinity-86-smart-1-bac-50cm-inox.html',
   date '2026-11-14',
   '{"الشكل":"مستطيل","عدد الأحواض":"1","التركيب":"عادي (فوق الرخام)","المقاس":"860×500 مم","فتحة التركيب":"1140×480 مم","عمق الحوض":"190 مم","المادّة":"إينوكس AISI 304 ساتان","مزايا":"ملحوم · بمصفاة · يتقلب يمين/يسار"}'::jsonb),

  ('FH861G', 'FOCUS', 'Focus', 'Firenze',
   'حوض مطبخ فوكس فيرينزي 86 صم — حوض واحد', 'Évier Firenze Focus 86 cm 1 Bac Inox',
   1, 'u', 249.000, true,
   'https://spacenet.tn/cuisine/53779-evier-firenze-1-bac-focus-86-cm-gauche-inox.html',
   date '2026-11-14',
   '{"الشكل":"مستطيل","عدد الأحواض":"1","التركيب":"عادي","المقاس":"860×500 مم","فتحة التركيب":"840×480 مم","اللون":"إينوكس","الضمان":"سنتين"}'::jsonb),

  ('BOX-SOTTOTOP-400', 'INFINITY', 'Infinity', 'Box 400',
   'حوض مطبخ إنفينيتي بوكس 400 — تحت الرخام', 'Évier Infinity Box 400 Sottotop 1 Bac 44 cm Inox',
   1, 'u', 699.000, true,
   'https://spacenet.tn/cuisine/101738-evier-de-cuisine-infinity-box-400-sottotop-1-bac-44cm-inox.html',
   date '2026-11-14',
   '{"الشكل":"مربّع","عدد الأحواض":"1","التركيب":"تحت الرخام (sottotop)","المقاس":"440×440 مم","فتحة التركيب":"400×400 مم","عمق الحوض":"228 مم","المادّة":"إينوكس 304 ساتان","مزايا":"ملحوم · يتقلب"}'::jsonb)
on conflict (code) do nothing;

-- ---------- الربط ----------
insert into article_products (article_id, product_id, coverage_per_pack, coverage_note, sort_order)
select a.id, p.id, 1, 'جهاز واحد لكلّ وحدة.', 0
from articles a
cross join products p
where a.code like 'CU-03-%' and p.code in ('CH-Q6300X', 'F.605X', 'AMHD60B')
on conflict do nothing;

insert into article_products (article_id, product_id, coverage_per_pack, coverage_note, sort_order)
select a.id, p.id, 1, 'حوض واحد لكلّ وحدة. الحنفية والتوصيلات برّاه.', 0
from articles a
cross join products p
where a.code like 'CU-02-%' and p.code in ('SMART-86', 'FH861G', 'BOX-SOTTOTOP-400')
on conflict do nothing;

-- الأرخص افتراضياً في كلّ مقال، حتّى يقرّر الفريق غيره
update article_products ap
set is_default = true
from products p, articles a
where ap.product_id = p.id and ap.article_id = a.id
  and ((p.code = 'CH-Q6300X' and a.code like 'CU-03-%')
    or (p.code = 'SMART-86'  and a.code like 'CU-02-%'))
  and not exists (
    select 1 from article_products x where x.article_id = ap.article_id and x.is_default
  );
