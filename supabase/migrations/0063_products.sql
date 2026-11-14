-- ============================================================
-- 0063_products.sql · طبقة المنتَج
-- ============================================================
-- قرار 14 نوفمبر 2026: لا يُصنَّف الحريف. يختار منتجاً بعينه ويرى
-- قدّاش يكلّفه. وهذا يحتاج طبقةً ما كانتش موجودة.
--
-- عندنا اليوم طبقة وحدة: «مقال بسعر» — «دهن داخلي · 19 د/م²».
-- وهي لا تكفي للاختيار: ما فيها لا علامة ولا مواصفة ولا صورة، ولا
-- تقول لماذا هذا بـ18 د وهذا بـ24 د.
--
-- فالمنتَج طبقة تحته: Astralatex من أسترال · 5 كغ · مات · أكريليك.
-- والمقال يبقى هو ما يُسعَّر في البوردرو، والمنتَج هو ما يُختار.
--
-- والجسر بينهما رقم واحد: كم وحدةً من المقال تغطّيها عبوة واحدة.
-- بدونه لا يُحسب شيء — ولا يُخمَّن: حساب مبنيّ على تغطية مُخترَعة
-- يعطي سعراً يبدو دقيقاً وهو غلط. العمود يبقى فارغاً حتّى يملأه من
-- قرأ الورقة الفنّية.
-- ============================================================

-- ---------- المنتجات ----------
create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  -- مرجع المنتج عند صاحبه، لا عندنا
  code                text not null unique,
  manufacturer_code   text references manufacturers (code) on delete set null,
  brand               text,
  -- الجمّة: Astralatex · Vinylastral — تجمع مقاسات نفس المنتج
  range_name          text,
  name_ar             text not null,
  name_fr             text,
  -- العبوة كما تُباع: 5 كغ · 20 لتر · وحدة
  pack_size           numeric(12, 3),
  pack_unit           text,
  /*
   * السعر كما وُجد: أغلب الأسعار المعروضة في تونس مع الأداء، فنخزّن
   * ما رأيناه ونقول هل هو مع الأداء — تحويلٌ صامت إلى HT يضيّع
   * المصدر ويُدخل خطأً لا يُكتشف.
   */
  price               numeric(12, 3),
  price_includes_tax  boolean not null default true,
  tax_rate_pct        numeric(5, 2),
  -- من أين جاء السعر ومتى: رقم بلا مصدره لا يُراجَع
  price_source        text,
  price_checked_at    date,
  /*
   * متثبَّت منه: سعرٌ أكّده المورّد نفسه، لا سعر بائع بتخفيض.
   * المنتج لا يخرج للحريف إلّا وهذا صحيح.
   */
  price_verified      boolean not null default false,
  specs               jsonb,
  -- المعيار: NT 47.01 · EN 13813 — للمواد التي لا تُختار بالصورة
  standard            text,
  notes               text,
  is_active           boolean not null default true,
  is_public           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists products_manufacturer_idx on products (manufacturer_code);
create index if not exists products_public_idx on products (is_public) where is_active;

alter table products enable row level security;
revoke all on products from anon, authenticated;

-- ---------- ربط المنتَج بالمقال ----------
create table if not exists article_products (
  article_id        uuid not null references articles (id) on delete cascade,
  product_id        uuid not null references products (id) on delete cascade,
  /*
   * الجسر: كم وحدةً من المقال تغطّيها عبوة واحدة، بعدد الطبقات
   * المعتاد. «علبة 5 كغ تكفي 25 م² بطبقتين» ← 25.
   * فارغ = لا نحسب. تُعرض المادّة وسعرها، ويُقال إنّ التغطية ناقصة.
   */
  coverage_per_pack numeric(12, 3),
  coverage_note     text,
  is_default        boolean not null default false,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  primary key (article_id, product_id)
);

alter table article_products enable row level security;
revoke all on article_products from anon, authenticated;

-- مادّة افتراضية واحدة لكلّ مقال لا اثنتان
create unique index if not exists article_products_one_default
  on article_products (article_id) where is_default;

-- ---------- صور المنتجات ----------
-- نفس قاعدة صور المقالات: صورة بلا مصدر وإذن لا تُنشر. والصور هنا
-- أغلبها ملك مورّديها، فالخانتان ليستا تنظيماً بل شرط نشر.
create table if not exists product_media (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products (id) on delete cascade,
  storage_path text not null,
  credit       text,
  license      text,
  source_url   text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid references staff (user_id) on delete set null
);

create index if not exists product_media_product_idx on product_media (product_id, sort_order);

alter table product_media enable row level security;
revoke all on product_media from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- الهجرات تُعاد كلّها في كلّ تشغيل، فكلّ جملة تحتمل الإعادة
drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();

-- ---------- المصنّعون ----------
insert into manufacturers (code, name_ar, name_fr, website, is_active) values
  ('ASTRAL', 'أسترال', 'Astral', null, true),
  ('FLASH',  'فلاش',   'Flash',  null, true)
on conflict (code) do nothing;

-- ---------- بذرة أولى: الدهن ----------
-- ⚠ هذي أسعار **بائع** (spacenet.tn) بتخفيض، لا أسعار مورّد:
--   قُرئت يوم 14 نوفمبر 2026 من صفحات المنتجات، مع رابط كلّ واحدة.
--   price_verified = false، وis_public = false: لا تخرج للحريف ولا
--   تدخل عرضاً حتّى يؤكّدها أسترال أو موزّعه.
--   والمواصفات من صفحة البائع نفسها، وفيها تناقضات معروفة (نفس
--   المنتج «داخلي» في صفحة و«داخلي وخارجي» في أخرى) — الورقة الفنّية
--   للمصنّع هي المرجع عند المراجعة.
insert into products
  (code, manufacturer_code, brand, range_name, name_ar, name_fr,
   pack_size, pack_unit, price, price_includes_tax, price_source, price_checked_at, specs)
values
  ('AS-LATMT5', 'ASTRAL', 'Astral', 'Astralatex',
   'دهن أسترالاتكس مات 5 كغ أبيض', 'Astral Astralatex Mat 5 kg Blanc',
   5, 'kg', 22.500, true,
   'https://spacenet.tn/peinture/99477-peinture-astral-astralatex-mat-5kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","الاستعمال":"داخلي وخارجي","التشطيب":"مات","القاعدة":"أكريليك بالماء","الجفاف":"ساعة · يتعاد بعد 3 سواعي","التطبيق":"فرشاة · رولو · مسدّس"}'::jsonb),

  ('AS-VIN5', 'ASTRAL', 'Astral', 'Vinylastral',
   'دهن فينيلاسترال مات 5 كغ أبيض', 'Astral Vinylastral Mat 5 kg Blanc',
   5, 'kg', 18.000, true,
   'https://spacenet.tn/peinture/99482-peinture-astral-vinylastral-mat-5kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","التشطيب":"مات"}'::jsonb),

  ('AS-AQMAT5', 'ASTRAL', 'Astral', 'Aquastral',
   'دهن أكواسترال مات 5 كغ أبيض', 'Astral Aquastral Mat 5 kg Blanc',
   5, 'kg', 23.900, true,
   'https://spacenet.tn/peinture/99480-peinture-astral-aquastral-mat-5kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","التشطيب":"مات"}'::jsonb),

  ('AS-REX18', 'ASTRAL', 'Astral', 'Rexcim',
   'دهن ركسيم مات 18 كغ أبيض', 'Astral Rexcim Mat 18 kg Blanc',
   18, 'kg', 160.000, true,
   'https://spacenet.tn/peinture/99485-peinture-astral-rexcim-mat-18kg-blanc.html',
   date '2026-11-14',
   '{"النوع":"دهن حيطان","التشطيب":"مات","ملاحظة":"يثبّت الأرضيات الضعيفة"}'::jsonb)
on conflict (code) do nothing;

-- تُربط بمقالات الدهن الداخلي في كلّ مستوياتها. التغطية تبقى فارغة:
-- لا أحد قرأ الورقة الفنّية بعد، ولا نخترع رقماً يُحسب عليه سعر.
insert into article_products (article_id, product_id, sort_order)
select a.id, p.id, row_number() over (order by p.price)
from articles a
cross join products p
where a.code like 'PE-01-%'
  and p.manufacturer_code = 'ASTRAL'
on conflict do nothing;

comment on column article_products.coverage_per_pack is
  'كم وحدةً من المقال تغطّيها عبوة واحدة بعدد الطبقات المعتاد. فارغ = لا يُحسب سعر المادّة.';
comment on column products.price_verified is
  'سعر أكّده المورّد. المنتج لا يُنشر للحريف وهو false.';
