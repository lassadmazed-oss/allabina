-- ============================================================
-- الكاتالوج العمومي: ما يراه الزائر بلا حساب
-- ============================================================
-- كرّاس الشروط V2، القسم 03. الحال قبل اليوم: 333 مقالاً في القاعدة
-- بأسمائها وأسعارها، يقرأها الباك أوفيس وحده، وصفر صفحة عمومية
-- تعرضها. والقسم يطلب بطاقة لكلّ مقال فيها صور وحقوقها ومواصفات
-- وتوفّر وآجال وبدائل.

-- ---------- النشر قرار إداري لا حالة تقنية ----------
-- «النشر يتم بعد موافقة الإدارة». فالافتراضي مغلق: 333 سعراً لا تخرج
-- إلى العلن لأنّ مطوّراً شغّل هجرة.
alter table articles
  add column if not exists is_public boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references staff (user_id) on delete set null,
  -- المورّد الداخلي: يظهر اسمه للفريق لا للحريف
  add column if not exists manufacturer_code text references manufacturers (code) on delete set null,
  -- مواصفات وأبعاد وألوان — حرّة الشكل لأنّها تختلف بين لوط ولوط
  add column if not exists specs jsonb,
  -- in_stock | on_order | on_survey — و«بعد المعاينة» ليست صفراً
  add column if not exists availability text not null default 'on_order'
    check (availability in ('in_stock', 'on_order', 'on_survey')),
  add column if not exists lead_time_days smallint,
  -- ما يشمله السعر وما لا يشمله، وشروط الاستعمال
  add column if not exists installation_note text,
  add column if not exists usage_note text,
  add column if not exists description_fr text;

create index if not exists articles_public_idx on articles (is_public, lot_id) where is_public;

comment on column articles.is_public is
  'يظهر في الكاتالوج العمومي. مغلق افتراضياً: النشر قرار إدارة لا نتيجة هجرة.';
comment on column articles.availability is
  'in_stock متوفّر · on_order على الطلب · on_survey يُحدَّد بعد المعاينة — ولا يُحسب صفراً';

-- ---------- الصور وحقوقها ----------
-- «صور وحقوقها» في نصّ الكرّاس. صورة بلا مصدر وإذن لا تُنشر: الحقوق
-- عمود لا ملاحظة، حتّى لا تُنسى.
create table if not exists article_media (
  id            bigserial primary key,
  article_id    uuid not null references articles (id) on delete cascade,
  storage_path  text not null,
  alt_ar        text,
  alt_fr        text,
  -- من أين الصورة ومن أذن بها. فارغ = لا تُنشر.
  credit        text,
  license       text,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references staff (user_id) on delete set null
);

create index if not exists article_media_article_idx on article_media (article_id, sort_order);

alter table article_media enable row level security;
revoke all on article_media from anon, authenticated;

comment on table article_media is
  'صور المقالات. credit وlicense شرط النشر — صورة بلا إذن لا تخرج.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-media', 'article-media', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------- البدائل ----------
-- «بدائل» في بطاقة المقال، و«عند الاستئناف نقترح بدائل» للمتوقّف.
-- العلاقة متماثلة منطقياً لكن تُكتب باتّجاه واحد ويُقرأ الاتّجاهان.
create table if not exists article_alternatives (
  article_id      uuid not null references articles (id) on delete cascade,
  alternative_id  uuid not null references articles (id) on delete cascade,
  note            text,
  created_at      timestamptz not null default now(),
  primary key (article_id, alternative_id),
  -- مقال ليس بديلاً لنفسه
  check (article_id <> alternative_id)
);

alter table article_alternatives enable row level security;
revoke all on article_alternatives from anon, authenticated;

-- ---------- إعدادات العرض ----------
insert into app_settings (key, value, description) values
  ('catalog.public_enabled', 'false'::jsonb,
   'فتح الكاتالوج العمومي. مغلق حتّى تعتمد الإدارة المقالات وأسعارها.'),
  ('catalog.show_ttc', 'true'::jsonb,
   'عرض السعر مع الأداء إلى جانب السعر بلا أداء — «يبيّن HT/TTC بوضوح»'),
  ('catalog.compare_max', '3'::jsonb,
   'أقصى عدد مقالات تُقارَن معاً — الكرّاس يحدّده بثلاثة')
on conflict (key) do nothing;
