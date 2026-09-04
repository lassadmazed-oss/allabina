-- ============================================================
-- 0004_construction_prices.sql · أسعار البناء حسب مستوى التشطيب
-- ============================================================
-- سياسة مرنة: لا نموذج موحّد على الحريف. ثلاث فئات مرجعية للمتر
-- المربّع (بالدينار، دون احتساب الأداءات — HT)، مع devis تفصيلي
-- لكل مسكن قبل انطلاق الأشغال.
--
--   عادي              : بداية من 1 200 د/م² HT
--   متوسط ومحسّن       : 1 400 – 1 600 د/م² HT
--   Haut Standing     : 1 700 – 2 000 د/م² HT
--
-- الفرضية المرجعية لدراسة الجدوى والملفّ البنكي: 1 600 د/م² HT
-- مع دراسة حساسية في نطاق 1 200 – 2 000.
-- ============================================================

-- مستوى التشطيب
do $$ begin
  create type standing_tier as enum ('standard','mid','premium');
exception when duplicate_object then null; end $$;

-- توسيع جدول الأسعار: نطاق سعري + مستوى تشطيب + هل السعر دون أداء
alter table price_references add column if not exists tier          standing_tier;
alter table price_references add column if not exists price_min_tnd numeric(10,2);
alter table price_references add column if not exists price_max_tnd numeric(10,2);
alter table price_references add column if not exists is_ht         boolean not null default true;

-- المفتاح الفريد يصير على (الولاية، النطاق، المنتج، مستوى التشطيب)
alter table price_references drop constraint if exists price_references_gov_code_zone_product_key;
create unique index if not exists price_references_unique_idx
  on price_references (gov_code, zone, product, tier) nulls not distinct;

-- أسعار البناء: وطنية في هذه المرحلة (نفس الشبكة لكلّ الولايات)،
-- تُخصَّص حسب الولاية لاحقاً عند توفّر معطيات ميدانية.
insert into price_references (gov_code, zone, product, tier, price_per_m2_tnd, price_min_tnd, price_max_tnd, is_ht, source)
values
  ('SFX', null, 'construction', 'standard', 1200, 1200, 1350, true, 'سياسة التسعير الداخلية 2026 — HT'),
  ('SFX', null, 'construction', 'mid',      1500, 1400, 1600, true, 'سياسة التسعير الداخلية 2026 — HT'),
  ('SFX', null, 'construction', 'premium',  1850, 1700, 2000, true, 'سياسة التسعير الداخلية 2026 — HT')
on conflict do nothing;

-- تنظيف السطور القديمة الفارغة للبناء (بلا مستوى تشطيب)
delete from price_references
  where product = 'construction' and tier is null and price_per_m2_tnd is null;

-- إعدادات مرجعية
insert into app_settings (key, value, description) values
  ('build.reference_price_ht', '1600'::jsonb,
   'سعر المتر المربّع المرجعي للبناء (د.ت/م² HT) — يُعتمد في دراسة الجدوى والملفّ البنكي'),
  ('build.sensitivity_min_ht', '1200'::jsonb, 'الحدّ الأدنى لدراسة الحساسية (د.ت/م² HT)'),
  ('build.sensitivity_max_ht', '2000'::jsonb, 'الحدّ الأقصى لدراسة الحساسية (د.ت/م² HT)'),
  ('build.prices_are_ht',      'true'::jsonb, 'أسعار البناء مصرّح بها دون احتساب الأداءات'),
  ('finance.vat_pct',          null,          'نسبة الأداء على القيمة المضافة % — تُملأ بعد التثبّت، وقتها تُعرض الأسعار TTC أيضاً')
on conflict (key) do update
  set value = excluded.value, description = excluded.description, updated_at = now();

-- مستوى التشطيب المطلوب من الحريف
alter table housing_requests add column if not exists standing standing_tier;
