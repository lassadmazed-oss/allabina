-- ============================================================
-- 0021_network_intervenants.sql · شبكة المتدخلين والمزوّدين
-- كراس الشروط · القسم 17
-- ============================================================
-- ليست دليل إعلانات للحرفيين. هي أداة تنفيذ داخلية: قاعدة مركزية
-- لكلّ من يمكن أن يتدخّل في مشروع بناء، موزّعة جغرافياً، حتى تصل
-- اللبنة عند كلّ chantier إلى المتدخّل المؤهَّل والأقرب والمتوفّر.
--
-- قاعدة حاكمة (القسم 25): التصنيفات والاختصاصات والوثائق المطلوبة
-- كلّها في جداول لا في enum. إضافة «Photovoltaïque» أو «Domotique»
-- غداً عملية من الـBack-office، لا هجرة قاعدة بيانات ونشر جديد.
-- لذلك partner_kind القديم يبقى كما هو للشركاء المؤسّسيّين (بنوك،
-- جهات عمومية، جمعيات)، وهذه الشبكة تُبنى على جداول مستقلّة.
--
-- التسجيل ليس اعتماداً: كلّ ملفّ يمرّ على مسار تحقّق بثماني حالات.
-- ============================================================

-- ---------- 1. العائلات والتصنيفات ----------
create table if not exists intervenant_families (
  code       text primary key,
  name_ar    text not null,
  name_fr    text,
  sort_order int not null default 0
);

create table if not exists intervenant_categories (
  id          serial primary key,
  family_code text not null references intervenant_families(code) on delete restrict,
  code        text not null unique,
  name_ar     text not null,
  name_fr     text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists intervenant_categories_family_idx
  on intervenant_categories (family_code, is_active, sort_order);

drop trigger if exists intervenant_categories_touch on intervenant_categories;
create trigger intervenant_categories_touch before update on intervenant_categories
  for each row execute function touch_updated_at();

comment on table intervenant_categories is
  'اختصاصات المتدخّلين — تُضاف وتُعدَّل من الـBack-office بلا مطوّر (كراس الشروط 17.2)';

-- ---------- 2. Savoir-faire ----------
-- «أنا بنّاء» لا تكفي. نريد معرفة شنوّة بالضبط ينجم يعمل.
create table if not exists skills (
  id          serial primary key,
  category_id int not null references intervenant_categories(id) on delete cascade,
  name_ar     text not null,
  name_fr     text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  unique (category_id, name_ar)
);

create index if not exists skills_category_idx on skills (category_id, is_active, sort_order);

-- ---------- 3. أنواع الوثائق والإلزام حسب الصنف ----------
create table if not exists document_types (
  code       text primary key,
  name_ar    text not null,
  name_fr    text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

-- مهندس معماري وسبّاك مستقلّ لا يُطلب منهما نفس الملفّ.
create table if not exists category_documents (
  category_id   int  not null references intervenant_categories(id) on delete cascade,
  document_code text not null references document_types(code) on delete cascade,
  is_required   boolean not null default false,
  primary key (category_id, document_code)
);

-- ---------- 4. الأنواع ----------
do $$ begin
  create type intervenant_status as enum (
    'new', 'to_verify', 'docs_missing', 'verified',
    'validated', 'suspended', 'rejected', 'archived'
  );
exception when duplicate_object then null; end $$;

-- تُسجَّل الوضعية كما هي — لا يُستبعَد أحد آلياً لأنّه بلا patente.
-- الوضعية تحدّد الوثائق المطلوبة فقط.
do $$ begin
  create type intervenant_legal as enum (
    'independent',   -- حرفي مستقلّ
    'worker',        -- عامل
    'patente',       -- صاحب patente
    'company',       -- شركة
    'sole_prop',     -- مؤسّسة فردية
    'supplier',      -- مزوّد
    'design_office', -- مكتب دراسات
    'engineer',      -- مهندس / خبير
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type availability_status as enum (
    'available', 'busy', 'available_from', 'unavailable'
  );
exception when duplicate_object then null; end $$;

-- ---------- 5. الملفّ المهني 360° ----------
create table if not exists intervenants (
  id               uuid primary key default gen_random_uuid(),

  -- الهوية
  full_name        text not null,
  company_name     text,
  phone            text not null,
  whatsapp         text,
  email            text,

  -- التصنيف والخبرة
  category_id      int  not null references intervenant_categories(id) on delete restrict,
  legal_status     intervenant_legal not null default 'independent',
  years_experience smallint check (years_experience between 0 and 70),
  bio              text,

  -- المقرّ
  gov_code         text not null references governorates(code),
  delegation_id    int  references delegations(id) on delete set null,
  zone_id          int  references zones(id) on delete set null,
  address          text,

  -- نطاق التدخّل: المقرّ شيء والمناطق التي يقبل العمل فيها شيء آخر
  radius_km        smallint check (radius_km between 0 and 500),

  -- التوفّر
  availability     availability_status not null default 'available',
  available_from   date,

  -- مسار الاعتماد
  status           intervenant_status not null default 'new',
  status_note      text,
  validated_at     timestamptz,
  validated_by     uuid references auth.users(id),

  -- روابط اختيارية
  partner_id       uuid references partners(id) on delete set null,
  user_id          uuid references auth.users(id) on delete set null,

  source           text not null default 'public_form'
                     check (source in ('public_form', 'admin', 'import')),
  is_demo          boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists intervenants_status_idx     on intervenants (status, created_at desc);
create index if not exists intervenants_category_idx   on intervenants (category_id, status);
create index if not exists intervenants_geo_idx        on intervenants (gov_code, delegation_id);
create index if not exists intervenants_availability_idx on intervenants (availability)
  where status = 'validated';
create index if not exists intervenants_phone_idx      on intervenants (phone);
create index if not exists intervenants_demo_idx       on intervenants (is_demo) where is_demo;

drop trigger if exists intervenants_touch on intervenants;
create trigger intervenants_touch before update on intervenants
  for each row execute function touch_updated_at();

comment on table intervenants is
  'الملفّ المهني 360° — التسجيل لا يعني الاعتماد: status يبدأ new ولا يصل validated إلا بقرار بشري مسجَّل';

-- اختصاصات إضافية إلى جانب الاختصاص الرئيسي
create table if not exists intervenant_extra_categories (
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  category_id    int  not null references intervenant_categories(id) on delete cascade,
  primary key (intervenant_id, category_id)
);

create table if not exists intervenant_skills (
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  skill_id       int  not null references skills(id) on delete cascade,
  primary key (intervenant_id, skill_id)
);

-- متدخّل مقرّه ساقية الزيت قد يقبل العمل في كامل صفاقس
create table if not exists intervenant_zones (
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  delegation_id  int  not null references delegations(id) on delete cascade,
  primary key (intervenant_id, delegation_id)
);

create index if not exists intervenant_zones_deleg_idx on intervenant_zones (delegation_id);

-- ---------- 6. الوثائق المسلَّمة ----------
create table if not exists intervenant_documents (
  id             bigserial primary key,
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  document_code  text not null references document_types(code) on delete restrict,
  url            text,
  label          text,
  is_verified    boolean not null default false,
  expires_at     date,
  note           text,
  uploaded_at    timestamptz not null default now(),
  unique (intervenant_id, document_code)
);

create index if not exists intervenant_documents_expiry_idx
  on intervenant_documents (expires_at) where expires_at is not null;

-- ---------- 7. الأعمال السابقة ----------
create table if not exists portfolio_items (
  id             bigserial primary key,
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  title          text not null,          -- «Villa 150 m² – Sfax»
  description    text,                   -- «Installation plomberie complète»
  work_type      text,
  area_m2        numeric(10,2),
  gov_code       text references governorates(code),
  delegation_id  int  references delegations(id) on delete set null,
  done_at        date,                   -- تاريخ تقريبي
  created_at     timestamptz not null default now()
);

create index if not exists portfolio_items_intervenant_idx
  on portfolio_items (intervenant_id, done_at desc);

create table if not exists portfolio_media (
  id                bigserial primary key,
  portfolio_item_id bigint not null references portfolio_items(id) on delete cascade,
  kind              text not null check (kind in ('photo', 'video')),
  url               text not null,
  label             text,
  created_at        timestamptz not null default now()
);

-- ---------- 8. سجلّ الأثر ----------
-- من اتّخذ القرار + التاريخ + السبب (كراس الشروط 17.7)
create table if not exists intervenant_events (
  id             bigserial primary key,
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  event_type     text not null,          -- created | status_change | note | document | contact
  from_status    intervenant_status,
  to_status      intervenant_status,
  actor          uuid references auth.users(id),
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists intervenant_events_idx
  on intervenant_events (intervenant_id, created_at desc);

create or replace function log_intervenant_created() returns trigger
language plpgsql as $$
begin
  insert into intervenant_events (intervenant_id, event_type, to_status, note)
  values (new.id, 'created', new.status, 'تسجيل جديد في الشبكة');
  return new;
end $$;

drop trigger if exists intervenants_log_created on intervenants;
create trigger intervenants_log_created after insert on intervenants
  for each row execute function log_intervenant_created();

-- ---------- 9. RLS ----------
-- الشبكة أداة داخلية: لا قراءة عمومية إطلاقاً. التسجيل يمرّ عبر
-- Server Action بالمفتاح السرّي، على قاعدة المشروع: المتصفّح لا يكتب.
alter table intervenant_families      enable row level security;
alter table intervenant_categories    enable row level security;
alter table skills                    enable row level security;
alter table document_types            enable row level security;
alter table category_documents        enable row level security;
alter table intervenants              enable row level security;
alter table intervenant_extra_categories enable row level security;
alter table intervenant_skills        enable row level security;
alter table intervenant_zones         enable row level security;
alter table intervenant_documents     enable row level security;
alter table portfolio_items           enable row level security;
alter table portfolio_media           enable row level security;
alter table intervenant_events        enable row level security;

-- المراجع وحدها مقروءة للعموم: تعبئة قوائم استمارة الانضمام
do $$
declare t text;
begin
  foreach t in array array['intervenant_families','intervenant_categories','skills','document_types','category_documents']
  loop
    execute format('drop policy if exists %I_public_read on %I', t, t);
    execute format(
      'create policy %I_public_read on %I for select to anon, authenticated using (true)', t, t
    );
  end loop;
end $$;

-- كلّ ما يخصّ الأشخاص: الفريق وحده
do $$
declare t text;
begin
  foreach t in array array[
    'intervenants','intervenant_extra_categories','intervenant_skills','intervenant_zones',
    'intervenant_documents','portfolio_items','portfolio_media','intervenant_events'
  ]
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format(
      'create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t
    );
  end loop;
end $$;

drop policy if exists intervenants_staff_write on intervenants;
create policy intervenants_staff_write on intervenants for update to authenticated
  using (is_staff()) with check (is_staff());

-- ============================================================
-- بذرة التصنيفات — نقطة انطلاق تُعدَّل من الـBack-office
-- ============================================================
insert into intervenant_families (code, name_ar, name_fr, sort_order) values
  ('craft',     'الحرف والمقاولات', 'Métiers & Travaux',      1),
  ('technical', 'المهن الفنّية',     'Professions techniques', 2),
  ('company',   'الشركات',          'Entreprises',            3),
  ('supplier',  'المزوّدون',         'Fournisseurs',           4)
on conflict (code) do nothing;

insert into intervenant_categories (family_code, code, name_ar, name_fr, sort_order) values
  -- الحرف والمقاولات
  ('craft', 'macon',        'بنّاء',              'Maçon',              10),
  ('craft', 'coffreur',     'قالب خرسانة',        'Coffreur',           20),
  ('craft', 'ferrailleur',  'حدّاد تسليح',        'Ferrailleur',        30),
  ('craft', 'plombier',     'سبّاك',              'Plombier',           40),
  ('craft', 'electricien',  'كهربائي',            'Électricien',        50),
  ('craft', 'carreleur',    'مبلّط',              'Carreleur',          60),
  ('craft', 'peintre',      'دهّان',              'Peintre',            70),
  ('craft', 'platrier',     'جبّاس',              'Plâtrier',           80),
  ('craft', 'menuisier_bois','نجّار خشب',         'Menuisier bois',     90),
  ('craft', 'menuisier_alu','نجّار ألمنيوم',      'Menuisier aluminium',100),
  ('craft', 'etancheite',   'عزل مائي',           'Étanchéité',         110),
  ('craft', 'facadier',     'واجهات',             'Façadier',           120),
  ('craft', 'ferronnier',   'حدّاد',              'Ferronnier',         130),
  ('craft', 'climatisation','تكييف',              'Climatisation',      140),
  ('craft', 'chauffage',    'تدفئة',              'Chauffage',          150),
  ('craft', 'jardinage',    'بستنة',              'Jardinage',          160),
  ('craft', 'exterieurs',   'أشغال خارجية',       'Travaux extérieurs', 170),
  -- المهن الفنّية
  ('technical', 'architecte',      'مهندس معماري',        'Architecte',              10),
  ('technical', 'ingenieur_civil', 'مهندس مدني',          'Ingénieur génie civil',   20),
  ('technical', 'bureau_etudes',   'مكتب دراسات',         'Bureau d''études',        30),
  ('technical', 'geometre',        'مساح',                'Géomètre',                40),
  ('technical', 'topographe',      'طوبوغرافي',           'Topographe',              50),
  ('technical', 'decorateur',      'مهندس ديكور',         'Architecte d''intérieur', 60),
  ('technical', 'technicien',      'تقني بناء',           'Technicien bâtiment',     70),
  -- الشركات
  ('company', 'entreprise_generale', 'مقاولة عامّة',   'Entreprise générale',   10),
  ('company', 'entreprise_spec',     'مقاولة مختصّة',  'Entreprise spécialisée',20),
  ('company', 'promoteur',           'باعث عقاري',     'Promoteur immobilier',  30),
  ('company', 'sous_traitant',       'مناول',          'Sous-traitant',         40),
  -- المزوّدون
  ('supplier', 'comptoir',   'comptoir مواد بناء', 'Comptoir matériaux', 10),
  ('supplier', 'ciment',     'إسمنت',              'Ciment',             20),
  ('supplier', 'fer',        'حديد',               'Fer',                30),
  ('supplier', 'brique',     'آجرّ',               'Brique',             40),
  ('supplier', 'sable',      'رمل وحصى',           'Sable / Gravier',    50),
  ('supplier', 'beton',      'خرسانة',             'Béton',              60),
  ('supplier', 'carrelage',  'بلاط',               'Carrelage',          70),
  ('supplier', 'sanitaire',  'أدوات صحّية',        'Sanitaire',          80),
  ('supplier', 'plomberie',  'لوازم سباكة',        'Plomberie',          90),
  ('supplier', 'electricite','لوازم كهرباء',       'Électricité',        100),
  ('supplier', 'aluminium',  'ألمنيوم',            'Aluminium',          110),
  ('supplier', 'bois',       'خشب',                'Bois',               120),
  ('supplier', 'peinture',   'دهن',                'Peinture',           130),
  ('supplier', 'cuisine',    'مطابخ',              'Cuisine',            140),
  ('supplier', 'etancheite_f','مواد عزل',          'Étanchéité',         150)
on conflict (code) do nothing;

-- Savoir-faire — البذرة الأولى للمهن الأكثر طلباً
insert into skills (category_id, name_ar, name_fr, sort_order)
select c.id, s.name_ar, s.name_fr, s.sort_order
from (values
  ('macon', 'بناء الجدران',        'Maçonnerie',          10),
  ('macon', 'قواطع',               'Cloisons',            20),
  ('macon', 'تلبيس داخلي',         'Enduit intérieur',    30),
  ('macon', 'تلبيس خارجي',         'Enduit extérieur',    40),
  ('macon', 'واجهة',               'Façade',              50),
  ('macon', 'ترصيف آجرّ',          'Pose briques',        60),
  ('macon', 'أشغال ترميم',         'Rénovation',          70),

  ('plombier', 'تركيب صحّي',        'Installation sanitaire',      10),
  ('plombier', 'شبكة ماء',          'Réseau eau',                  20),
  ('plombier', 'صرف',               'Évacuation',                  30),
  ('plombier', 'سخّان ماء',         'Chauffe-eau',                 40),
  ('plombier', 'إصلاح أعطاب',       'Dépannage',                   50),
  ('plombier', 'تركيب دار كاملة',   'Installation complète maison',60),

  ('electricien', 'تمديد شبكة',      'Installation réseau',   10),
  ('electricien', 'لوحة كهرباء',     'Tableau électrique',    20),
  ('electricien', 'إنارة',           'Éclairage',             30),
  ('electricien', 'إصلاح أعطاب',     'Dépannage',             40),
  ('electricien', 'تركيب دار كاملة', 'Installation complète', 50),

  ('carreleur', 'بلاط أرضية',       'Carrelage sol',      10),
  ('carreleur', 'بلاط جدران',       'Faïence murale',     20),
  ('carreleur', 'رخام',             'Marbre',             30),
  ('carreleur', 'درج',              'Escalier',           40),

  ('peintre', 'دهن داخلي',          'Peinture intérieure', 10),
  ('peintre', 'دهن خارجي',          'Peinture extérieure', 20),
  ('peintre', 'تحضير الجدران',      'Préparation murs',    30),
  ('peintre', 'ديكور',              'Peinture décorative', 40),

  ('menuisier_alu', 'نوافذ',        'Fenêtres',      10),
  ('menuisier_alu', 'أبواب',        'Portes',        20),
  ('menuisier_alu', 'واجهات زجاجية','Murs rideaux',  30),

  ('etancheite', 'عزل سطح',         'Étanchéité toiture', 10),
  ('etancheite', 'عزل حمّامات',     'Étanchéité SDB',     20),
  ('etancheite', 'عزل أساسات',      'Étanchéité fondations', 30)
) as s(cat_code, name_ar, name_fr, sort_order)
join intervenant_categories c on c.code = s.cat_code
on conflict (category_id, name_ar) do nothing;

-- أنواع الوثائق
insert into document_types (code, name_ar, name_fr, sort_order) values
  ('cin',        'بطاقة تعريف',      'CIN',                 10),
  ('patente',    'Patente',          'Patente',             20),
  ('rne',        'RNE',              'RNE',                 30),
  ('company_doc','وثائق الشركة',     'Documents société',   40),
  ('diplome',    'شهادة علمية',      'Diplôme',             50),
  ('agrement',   'اعتماد',           'Agrément',            60),
  ('assurance',  'تأمين',            'Assurance',           70),
  ('cert_pro',   'شهادة مهنية',      'Certificat pro',      80),
  ('other',      'وثيقة أخرى',       'Autre document',      90)
on conflict (code) do nothing;

-- الإلزام حسب الصنف: بطاقة التعريف على الجميع
insert into category_documents (category_id, document_code, is_required)
select id, 'cin', true from intervenant_categories
on conflict do nothing;

-- الشركات والمزوّدون: RNE ووثائق الشركة إلزامية
insert into category_documents (category_id, document_code, is_required)
select c.id, d.code, true
from intervenant_categories c
cross join (values ('rne'), ('company_doc')) as d(code)
where c.family_code in ('company', 'supplier')
on conflict do nothing;

-- المهن الفنّية: الشهادة العلمية والتأمين إلزاميان
insert into category_documents (category_id, document_code, is_required)
select c.id, d.code, true
from intervenant_categories c
cross join (values ('diplome'), ('assurance')) as d(code)
where c.family_code = 'technical'
on conflict do nothing;

-- الحرف: patente اختيارية — لا يُستبعَد الحرفي المستقلّ
insert into category_documents (category_id, document_code, is_required)
select c.id, 'patente', false
from intervenant_categories c
where c.family_code = 'craft'
on conflict do nothing;
