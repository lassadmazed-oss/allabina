-- ============================================================
-- 0064_paint_products.sql · صنف الدهن كاملاً
-- ============================================================
-- سبعة مراجع دهن حيطان من علامتين (أسترال وفلاش)، ومعها دهن خشب
-- وسوس-كوش. كلّها قُرئت يوم 14 نوفمبر 2026 من صفحات البائع
-- spacenet.tn، وكلّ واحد برابطه.
--
-- ⚠ أسعار بائع بتخفيض، لا أسعار مورّد: price_verified = false
--   وis_public = false. لا تخرج لحريف ولا تدخل عرضاً حتّى يؤكّدها
--   أسترال أو فلاش أو موزّعهما.
--
-- والجديد هنا: **ثلاث صفحات تنشر المردود**، فالتغطية تُملأ بمصدرها
-- لا بالتخمين:
--   · Flasch Classique: «4 إلى 5 م²/كغ للطبقة · طبقتان»
--     أخذنا 4 — الطرف الأحوط. الأقلّ تغطيةً يعطي كلفةً أعلى، وخطأٌ
--     في هذا الاتّجاه يُكلّف الشركة لا الحريف.
--   · Aquastral Satin: «±10 م²/كغ للطبقة · طبقتان»
--   · Astralatex Prim: «±16 م²/لتر للطبقة · طبقتان»
-- والبقيّة تبقى فارغة حتّى تُقرأ أوراقها الفنّية.
-- ============================================================

insert into manufacturers (code, name_ar, name_fr, is_active) values
  ('FLASCH', 'فلاش', 'Flasch', true)
on conflict (code) do nothing;

insert into products
  (code, manufacturer_code, brand, range_name, name_ar, name_fr,
   pack_size, pack_unit, price, price_includes_tax, price_source, price_checked_at, specs)
values
  -- ── دهن حيطان ──
  ('F-C40', 'FLASCH', 'Flasch', 'Classique',
   'دهن فلاش كلاسيك 40 كغ أبيض', 'Flasch Classique 40 kg Blanc',
   40, 'kg', 75.000, true,
   'https://spacenet.tn/peinture/50570-peinture-flasch-classique-40-kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان للأشغال العادية","القاعدة":"كوبوليمير ستيران-أكريليك في الماء","المردود":"4 إلى 5 م²/كغ للطبقة","عدد الطبقات":"2","الجفاف":"2 إلى 3 سواعي"}'::jsonb),

  ('AS-VIN40', 'ASTRAL', 'Astral', 'Vinylastral',
   'دهن فينيلاسترال مات 40 كغ أبيض', 'Astral Vinylastral Mat 40 kg Blanc',
   40, 'kg', 99.000, true,
   'https://spacenet.tn/peinture/99468-peinture-astral-vinylastral-mat-40-kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","الاستعمال":"داخلي وخارجي","التشطيب":"مات","القاعدة":"مستحلب أكريليك بالماء"}'::jsonb),

  ('AS-LATMAT23', 'ASTRAL', 'Astral', 'Astralatex',
   'دهن أسترالاتكس مات 23 كغ أبيض', 'Astral Astralatex Mat 23 kg Blanc',
   23, 'kg', 88.900, true,
   'https://spacenet.tn/peinture/99478-peinture-astral-astralatex-mat-23-kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","الاستعمال":"داخلي وخارجي","التشطيب":"مات","القاعدة":"أكريليك بالماء"}'::jsonb),

  ('AS-AQS5', 'ASTRAL', 'Astral', 'Aquastral',
   'دهن أكواسترال ساتان 5 كغ أبيض', 'Astral Aquastral Satin 5 kg Blanc',
   5, 'kg', 60.000, true,
   'https://spacenet.tn/peinture/99486-peinture-astral-aquastral-satin-5-kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","الاستعمال":"داخلي وخارجي","التشطيب":"ساتان، يتغسّل","القاعدة":"أكريليك ساتان بالماء","المردود":"±10 م²/كغ للطبقة","عدد الطبقات":"2","الجفاف":"ساعة ونصف · يتعاد بعد 7 سواعي","مزايا":"طبقة مرنة · ريحة خفيفة"}'::jsonb),

  -- ── سوس-كوش ──
  ('AS-LATP18', 'ASTRAL', 'Astral', 'Astralatex Prim',
   'سوس-كوش أسترالاتكس بريم 18 لتر أبيض', 'Astralatex Prim Astral 18 L Blanc',
   18, 'L', 129.000, true,
   'https://spacenet.tn/peinture/99531-astralatex-prim-astral-18l-blanc.html',
   date '2026-11-14',
   '{"النوع":"سوس-كوش · طبقة تعلّق","الاستعمال":"داخلي وخارجي","التشطيب":"مات","المردود":"±16 م²/لتر للطبقة","عدد الطبقات":"2"}'::jsonb),

  -- ── دهن خشب ──
  ('AS-LAK4LS', 'ASTRAL', 'Astral', 'Lakalo',
   'دهن خشب لاكالو ساتان 4 لتر أبيض', 'Astral Lakalo Satiné 4 L Blanc',
   4, 'L', 82.000, true,
   'https://spacenet.tn/peinture/99502-peinture-astral-lakalo-satine-4l-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن خشب","الاستعمال":"داخلي — بيبان وشبابك وموبيليا","التشطيب":"ساتان","القاعدة":"أكريليك بالماء","الجفاف":"ساعة لساعتين للمسّ · 24 ساعة كامل"}'::jsonb)
on conflict (code) do nothing;

-- ---------- الربط ----------
-- دهن الحيطان للداخلي والخارجي حسب ما تقوله صفحة كلّ منتج.
-- فلاش كلاسيك: صفحته تقول «أشغال عادية» ولا تذكر الخارجي، فداخلي وحده.
insert into article_products (article_id, product_id, sort_order)
select a.id, p.id, 0
from articles a
cross join products p
where a.code like 'PE-01-%'
  and p.code in ('F-C40', 'AS-VIN40', 'AS-LATMAT23', 'AS-AQS5')
on conflict do nothing;

insert into article_products (article_id, product_id, sort_order)
select a.id, p.id, 0
from articles a
cross join products p
where a.code like 'PE-02-%'
  and p.code in ('AS-VIN5', 'AS-VIN40', 'AS-LATMT5', 'AS-LATMAT23', 'AS-AQMAT5', 'AS-AQS5')
on conflict do nothing;

-- ---------- التغطية، من المردود المنشور ----------
update article_products ap
set coverage_per_pack = 80,
    coverage_note = 'من مردود المصنّع: 4 م²/كغ للطبقة × 40 كغ ÷ طبقتين. أخذنا الطرف الأحوط من «4 إلى 5».'
from products p
where ap.product_id = p.id and p.code = 'F-C40' and ap.coverage_per_pack is null;

update article_products ap
set coverage_per_pack = 25,
    coverage_note = 'من مردود المصنّع: ±10 م²/كغ للطبقة × 5 كغ ÷ طبقتين.'
from products p
where ap.product_id = p.id and p.code = 'AS-AQS5' and ap.coverage_per_pack is null;

-- المادّة الافتراضية للدهن الداخلي: الأرخص الصالح، حتّى يقرّر الفريق غيرها
update article_products ap
set is_default = true
from products p, articles a
where ap.product_id = p.id and ap.article_id = a.id
  and p.code = 'F-C40' and a.code like 'PE-01-%'
  and not exists (
    select 1 from article_products x where x.article_id = ap.article_id and x.is_default
  );
