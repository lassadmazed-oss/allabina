-- ============================================================
-- 0010_bordereau_devis.sql
--   Master Bordereau · قاعدة الأسعار · مواصفات المشروع · الـDevis
-- ============================================================
-- قاعدتان لا يُتهاون فيهما:
--   1. لا سعر داخل الكود — كلّ شيء هنا وتضبطه الإدارة.
--   2. الـDevis يُجمَّد وقت توليده: كلّ سطر ينسخ السعر والكمية والوحدة،
--      فتغيير سعر لاحقاً لا يعيد كتابة عرض قديم.
-- ============================================================

-- ---------- الوحدات ----------
do $$ begin
  create type article_unit as enum ('m2', 'ml', 'm3', 'kg', 'u', 'forfait');
exception when duplicate_object then null; end $$;

do $$ begin
  create type devis_status as enum ('draft', 'sent', 'accepted', 'obsolete');
exception when duplicate_object then null; end $$;

-- ---------- Lots ----------
create table if not exists lots (
  id         serial primary key,
  code       smallint not null unique,      -- 1..20
  name_ar    text not null,
  name_fr    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into lots (code, name_ar, name_fr) values
  (1,  'الدراسات والتحضير',        'Études & préparation'),
  (2,  'الحفر والتسوية',           'Terrassement'),
  (3,  'الأساسات',                 'Fondations'),
  (4,  'الخرسانة المسلّحة والهيكل', 'Béton armé / Structure'),
  (5,  'البناء',                   'Maçonnerie'),
  (6,  'التلبيس الداخلي والخارجي',  'Enduits intérieur / extérieur'),
  (7,  'العزل والحماية من المياه',  'Étanchéité & isolation'),
  (8,  'السباكة',                  'Plomberie'),
  (9,  'الكهرباء',                 'Électricité'),
  (10, 'الفرش والتغطية',           'Revêtements'),
  (11, 'الألمنيوم',                'Aluminium'),
  (12, 'النجارة الخشبية',          'Menuiserie bois'),
  (13, 'الحدادة',                  'Ferronnerie'),
  (14, 'الدهن',                    'Peinture'),
  (15, 'المطبخ',                   'Cuisine'),
  (16, 'السقف المستعار',           'Faux plafond'),
  (17, 'التكييف والتدفئة',         'Climatisation / chauffage'),
  (18, 'الواجهة',                  'Façade'),
  (19, 'التهيئة الخارجية',         'Aménagement extérieur'),
  (20, 'التنظيف والتسليم',         'Nettoyage & réception')
on conflict (code) do nothing;

-- ---------- Articles ----------
-- qty_formula: صيغة تُحسب من مواصفات المشروع، مثال: 'surface * 1.15'
-- المتغيّرات المتاحة: surface · levels · bedrooms · bathrooms · kitchens
--                     · living_rooms · garage · terrasse · jardin · land_area
create table if not exists articles (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  lot_id           int not null references lots(id) on delete restrict,
  designation_ar   text not null,
  designation_fr   text,
  description      text,
  unit             article_unit not null,
  qty_formula      text not null default '0',
  standing         standing_tier,            -- null = يصلح لكلّ المستويات
  gov_code         text references governorates(code),  -- null = كلّ الجهات
  pu_fourniture_ht numeric(10,3) not null default 0,
  pu_main_oeuvre_ht numeric(10,3) not null default 0,
  is_active        boolean not null default true,
  updated_by       uuid references auth.users(id),
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists articles_lot_idx on articles (lot_id, is_active);
create index if not exists articles_scope_idx on articles (standing, gov_code) where is_active;

drop trigger if exists articles_touch on articles;
create trigger articles_touch before update on articles
  for each row execute function touch_updated_at();

-- ---------- تاريخ الأسعار ----------
-- كلّ تغيير سعر يُسجَّل: من غيّره ومتى وبكم — للمساءلة والمقارنة.
create table if not exists article_price_history (
  id                bigserial primary key,
  article_id        uuid not null references articles(id) on delete cascade,
  pu_fourniture_ht  numeric(10,3) not null,
  pu_main_oeuvre_ht numeric(10,3) not null,
  changed_by        uuid references auth.users(id),
  note              text,
  changed_at        timestamptz not null default now()
);

create index if not exists article_price_history_idx
  on article_price_history (article_id, changed_at desc);

create or replace function log_article_price() returns trigger
language plpgsql as $$
begin
  if new.pu_fourniture_ht is distinct from old.pu_fourniture_ht
     or new.pu_main_oeuvre_ht is distinct from old.pu_main_oeuvre_ht then
    insert into article_price_history
      (article_id, pu_fourniture_ht, pu_main_oeuvre_ht, changed_by)
    values (new.id, new.pu_fourniture_ht, new.pu_main_oeuvre_ht, new.updated_by);
  end if;
  return new;
end $$;

drop trigger if exists articles_price_log on articles;
create trigger articles_price_log after update on articles
  for each row execute function log_article_price();

-- ---------- مواصفات المشروع ----------
create table if not exists project_configs (
  request_id    uuid primary key references housing_requests(id) on delete cascade,
  surface_m2    numeric(8,2),
  levels        smallint not null default 1 check (levels between 1 and 4),
  bedrooms      smallint,
  living_rooms  smallint default 1,
  kitchens      smallint default 1,
  bathrooms     smallint,
  garage        boolean not null default false,
  terrasse      boolean not null default false,
  jardin        boolean not null default false,
  standing      standing_tier,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists project_configs_touch on project_configs;
create trigger project_configs_touch before update on project_configs
  for each row execute function touch_updated_at();

-- ---------- الـDevis ----------
create table if not exists devis (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references housing_requests(id) on delete cascade,
  version      smallint not null default 1,
  ref_code     text unique not null,
  standing     standing_tier,
  gov_code     text references governorates(code),
  surface_m2   numeric(8,2),
  total_ht     numeric(12,2) not null default 0,
  status       devis_status not null default 'draft',
  note         text,
  generated_by uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (request_id, version)
);

create index if not exists devis_request_idx on devis (request_id, version desc);

create sequence if not exists devis_ref_seq start 1;

create or replace function next_devis_ref() returns text
language sql volatile as $$
  select 'DV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('devis_ref_seq')::text, 6, '0');
$$;

alter table devis alter column ref_code set default next_devis_ref();

drop trigger if exists devis_touch on devis;
create trigger devis_touch before update on devis
  for each row execute function touch_updated_at();

-- ---------- أسطر الـDevis — نسخة مجمّدة ----------
-- كلّ الحقول منسوخة عمداً: لو حُذف المقال أو تغيّر سعره، يبقى العرض كما صدر.
create table if not exists devis_lines (
  id                bigserial primary key,
  devis_id          uuid not null references devis(id) on delete cascade,
  article_id        uuid references articles(id) on delete set null,  -- للمرجع فقط
  lot_code          smallint not null,
  lot_name_ar       text not null,
  article_code      text not null,
  designation_ar    text not null,
  unit              article_unit not null,
  quantity          numeric(12,3) not null,
  pu_fourniture_ht  numeric(10,3) not null,
  pu_main_oeuvre_ht numeric(10,3) not null,
  pu_total_ht       numeric(10,3) not null,
  total_ht          numeric(12,2) not null,
  sort_order        int not null default 0
);

create index if not exists devis_lines_devis_idx on devis_lines (devis_id, lot_code, sort_order);

-- ---------- التشطيبات ----------
create table if not exists finish_categories (
  id         serial primary key,
  code       text not null unique,
  name_ar    text not null,
  name_fr    text,
  lot_id     int references lots(id),
  is_active  boolean not null default true,
  sort_order int not null default 0
);

insert into finish_categories (code, name_ar, name_fr, sort_order) values
  ('revetement',  'الفرش',          'Revêtement',  1),
  ('carrelage',   'البلاط',         'Carrelage',   2),
  ('faience',     'الفايانس',       'Faïence',     3),
  ('aluminium',   'الألمنيوم',      'Aluminium',   4),
  ('portes',      'الأبواب',        'Portes',      5),
  ('peinture',    'الدهن',          'Peinture',    6),
  ('sanitaires',  'الأدوات الصحية', 'Sanitaires',  7),
  ('robinetterie','الحنفيات',       'Robinetterie',8),
  ('cuisine',     'المطبخ',         'Cuisine',     9),
  ('facade',      'الواجهة',        'Façade',     10)
on conflict (code) do nothing;

create table if not exists finish_options (
  id            uuid primary key default gen_random_uuid(),
  category_id   int not null references finish_categories(id) on delete cascade,
  name_ar       text not null,
  name_fr       text,
  specs         text,
  image_url     text,
  unit          article_unit not null default 'm2',
  pu_ht         numeric(10,3) not null default 0,
  standing      standing_tier,          -- الخيار الافتراضي لهذا المستوى
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists finish_options_category_idx on finish_options (category_id, is_active);

-- اختيارات الحريف
create table if not exists request_finishes (
  request_id  uuid not null references housing_requests(id) on delete cascade,
  category_id int not null references finish_categories(id) on delete cascade,
  option_id   uuid references finish_options(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (request_id, category_id)
);

-- ---------- RLS ----------
alter table lots                  enable row level security;
alter table articles              enable row level security;
alter table article_price_history enable row level security;
alter table project_configs       enable row level security;
alter table devis                 enable row level security;
alter table devis_lines           enable row level security;
alter table finish_categories     enable row level security;
alter table finish_options        enable row level security;
alter table request_finishes      enable row level security;

-- الفئات والخيارات مقروءة للعموم (يتصفّحها المواطن)، والباقي للفريق
drop policy if exists finish_categories_public on finish_categories;
create policy finish_categories_public on finish_categories
  for select to anon, authenticated using (is_active);

drop policy if exists finish_options_public on finish_options;
create policy finish_options_public on finish_options
  for select to anon, authenticated using (is_active);

drop policy if exists lots_public on lots;
create policy lots_public on lots for select to anon, authenticated using (is_active);

do $$
declare t text;
begin
  foreach t in array array['articles','article_price_history','project_configs',
                           'devis','devis_lines','request_finishes']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;
