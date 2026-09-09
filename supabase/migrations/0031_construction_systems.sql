-- ============================================================
-- 0031_construction_systems.sql · طريقة البناء ككائن مستقلّ
-- كراس الشروط · القسم 12
-- ============================================================
-- المنصة كانت تفترض طريقة بناء واحدة ضمنيّة: بوردرو واحد وDevis واحد،
-- والبوردرو القائم هو «التقليدي» بلا أن يقول ذلك. هذه الهجرة تُخرج
-- الافتراض إلى العلن وتفتح الباب لنظام ثانٍ وثالث بلا برمجة.
--
-- تصميمها يفصل ثلاثة أشياء كان يخلطها الفصل الأوّل من الكراس:
--   1. النظام      — ما يراه المواطن: «تقليدي» أو «بلوك + poutrelles»
--   2. المصنّع     — Driss Agglo · SIREP-PREFA
--   3. العرض       — تطبيق مصنّع بعينه لنظام بعينه، وعليه تُعلَّق الأرقام
--
-- السبب: كلّ رقم في الوثائق (بحر 4,80 م · 10 وحدات/م² · حريق ساعة) هو
-- رقم **مصنّع بعينه**، لا رقم «النظام». خلط الاثنين يعني نسبة رقم إلى
-- وثيقة لا تحتويه — وفي السقوف هذا خطر لا خطأ تحريري.
-- ============================================================

-- ---------- 1. النظام: ما يراه المواطن ----------
create table if not exists construction_systems (
  code             text primary key,
  name_ar          text not null,
  name_fr          text,
  -- بطاقة المواطن: جملة أو جملتان، بلا هندسة
  citizen_summary_ar text not null,
  citizen_summary_fr text,
  -- شرح «اكتشف طريقة البناء»
  principle_ar     text,
  principle_fr     text,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table construction_systems is
  'أنظمة البناء — بلا أرقام ولا مزايا مقيسة: الأرقام تُعلَّق على العرض (مصنّع × نظام)';

drop trigger if exists construction_systems_touch on construction_systems;
create trigger construction_systems_touch before update on construction_systems
  for each row execute function touch_updated_at();

-- ---------- 2. المصنّعون ----------
create table if not exists manufacturers (
  code        text primary key,
  name_ar     text not null,
  name_fr     text,
  gov_code    text references governorates(code),
  delegation_id int references delegations(id) on delete set null,
  address     text,
  phone       text,
  website     text,
  -- ربط اختياري ببطاقة المزوّد في شبكة المتدخّلين
  intervenant_id uuid references intervenants(id) on delete set null,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- 3. العرض: تطبيق مصنّع لنظام ----------
create table if not exists system_offerings (
  id              serial primary key,
  system_code     text not null references construction_systems(code) on delete cascade,
  manufacturer_code text references manufacturers(code) on delete set null,
  -- أيّ جزء من المبنى يخدمه هذا العرض
  element_scope   text not null check (element_scope in ('mur', 'plancher', 'cloture')),
  label_ar        text not null,
  -- الحالة: مسوّدة حتى تكتمل وثائقه
  status          text not null default 'draft' check (status in ('draft', 'partial', 'published')),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (system_code, manufacturer_code, element_scope)
);

comment on table system_offerings is
  'مصنّع × نظام × جزء من المبنى — الوحدة التي تُعلَّق عليها الوثائق والعناصر والحدود';

-- ---------- 4. وثائق العرض ----------
create table if not exists offering_documents (
  id            serial primary key,
  offering_id   int not null references system_offerings(id) on delete cascade,
  doc_kind      text not null check (doc_kind in
                  ('avis_technique', 'plan', 'note_calcul', 'fiche', 'methode', 'autre')),
  ref_code      text,                          -- مثال: DRISS AGGLO-02-OMB/2023
  title         text not null,
  version       text,
  issued_on     date,
  storage_path  text,
  source_url    text,
  is_normative  boolean not null default true, -- تُسنَد إليها الأرقام
  created_at    timestamptz not null default now()
);

-- ---------- 5. كتالوج العناصر ----------
-- الحارس: عمود كهرباء أو أنبوب لا يدخل كتالوج عناصر المسكن ولو كان
-- مصنّعه هو نفسه. معيار الدخول نطاق الاستعمال لا اسم المنتَج.
create table if not exists system_components (
  id            serial primary key,
  offering_id   int not null references system_offerings(id) on delete cascade,
  ref_fabricant text not null,                 -- BC20-6N · E15 · P15-42
  name_ar       text not null,
  usage_domain  text not null check (usage_domain in ('mur', 'plancher', 'cloture')),
  length_mm     int,
  width_mm      int,
  height_mm     int,
  role_ar       text,                          -- «عمود دائري R 8 صم»
  is_load_bearing boolean,                     -- null = لا ينطبق
  document_id   int references offering_documents(id) on delete set null,
  sort_order    int not null default 0,
  unique (offering_id, ref_fabricant)
);

-- ---------- 6. حدود البحور ----------
-- الجدول الذي يمنع البرنامج من اختيار السقف وحده.
create table if not exists span_limits (
  id            serial primary key,
  offering_id   int not null references system_offerings(id) on delete cascade,
  document_id   int not null references offering_documents(id) on delete restrict,
  usage_code    text not null,                 -- habitation · bureaux · commerce · terrasse
  usage_ar      text not null,
  load_kn_m2    numeric(5,2) not null,
  assembly_code text not null,                 -- 12+4 · 15+5 · 20+6
  span_max_m    numeric(5,2) not null,
  reinforcement text,                          -- 2HA12
  unique (offering_id, usage_code, assembly_code)
);

comment on table span_limits is
  'بحور قصوى من وثيقة مصنّع بعينه — المنصة تقترح، والمهندس يقرّر التركيبة';

-- ---------- 7. كمّيات مسنَدة إلى وثيقة ----------
create table if not exists offering_quantity_rules (
  id           serial primary key,
  offering_id  int not null references system_offerings(id) on delete cascade,
  document_id  int not null references offering_documents(id) on delete restrict,
  rule_key     text not null,                  -- units_per_m2 · mortar_l_per_m2
  variant      text,                           -- سماكة 20 · 22 · 25
  value        numeric(10,3) not null,
  unit_ar      text not null,
  condition_ar text,
  unique (offering_id, rule_key, variant)
);

-- ---------- 8. ربط البوردرو والمشروع بالنظام ----------
-- البوردرو القائم هو «التقليدي» ضمنياً: نقولها صراحةً.
alter table articles         add column if not exists system_code text references construction_systems(code);
alter table project_configs  add column if not exists system_code text references construction_systems(code);
alter table devis            add column if not exists system_code text references construction_systems(code);

create index if not exists articles_system_idx on articles (system_code, is_active);

-- تركيبة السقف: من حدّدها ومتى — قرار بشري يُسجَّل
alter table project_configs add column if not exists floor_assembly text;
alter table project_configs add column if not exists assembly_by    uuid references auth.users(id);
alter table project_configs add column if not exists assembly_at    timestamptz;
alter table project_configs add column if not exists assembly_note  text;

-- ---------- 9. RLS ----------
alter table construction_systems     enable row level security;
alter table manufacturers            enable row level security;
alter table system_offerings         enable row level security;
alter table offering_documents       enable row level security;
alter table system_components        enable row level security;
alter table span_limits              enable row level security;
alter table offering_quantity_rules  enable row level security;

-- الأنظمة وحدها عمومية: هي ما يختاره المواطن
drop policy if exists construction_systems_public on construction_systems;
create policy construction_systems_public on construction_systems
  for select to anon, authenticated using (is_active);

do $$
declare t text;
begin
  foreach t in array array[
    'manufacturers','system_offerings','offering_documents',
    'system_components','span_limits','offering_quantity_rules'
  ]
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format(
      'create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t
    );
  end loop;
end $$;

-- ============================================================
-- البذرة
-- ============================================================
insert into construction_systems
  (code, name_ar, name_fr, citizen_summary_ar, citizen_summary_fr, principle_ar, sort_order)
values
  (
    'TRAD', 'البناء التقليدي', 'Construction traditionnelle',
    'بناء بالطوب/الآجرّ والنظام التقليدي للسقف.',
    'Maçonnerie en briques et plancher traditionnel.',
    'الطريقة الأكثر انتشاراً في تونس: جدران بالآجرّ وسقف يُصبّ في الموقع. اليد العاملة متوفّرة في كلّ معتمدية، والمواد تُشترى من أيّ comptoir.',
    1
  ),
  (
    'BLOC_PPE', 'البلوك الخرساني + سقف Poutrelles', 'Bloc béton + plancher poutrelles',
    'جدران ببلوك خرساني معياري 50×20 صم، وسقف بعناصر مسبقة الصنع تُركَّب في الموقع.',
    'Murs en blocs béton modulaires 50×20 cm et plancher en éléments préfabriqués.',
    'نظام يعتمد بلوكات خرسانية معيارية مجوّفة، مع بلوكات عادية وأخرى خاصّة بالربط والتقوية. تُملأ بعض التجاويف بخرسانة تُصبّ في الموقع. الأبعاد تسمح بتنسيق أبعاد بمضاعفات 25 صم. السقف عناصر مسبقة الصنع تُركَّب ثمّ يُستكمل التسليح والصبّة حسب الدراسة الفنّية.',
    2
  )
on conflict (code) do nothing;

-- كلّ مقال قائم في البوردرو هو تقليدي حتى يُقال غير ذلك
update articles set system_code = 'TRAD' where system_code is null;
update project_configs set system_code = 'TRAD' where system_code is null;
update devis set system_code = 'TRAD' where system_code is null;

insert into manufacturers (code, name_ar, name_fr, gov_code, address, website) values
  ('DRISS', 'دريس أغلو', 'Driss Agglo', 'SFX', 'صفاقس', null),
  ('SIREP', 'سيراب بريفا', 'SIREP-PREFA', 'SFX',
   'الصخيرة — طريق قابس كم 86 · ص.ب 61 · 3050', 'https://www.sirep-prefa.com.tn')
on conflict (code) do nothing;

-- عرضا Driss Agglo: الجدران والسقف
insert into system_offerings (system_code, manufacturer_code, element_scope, label_ar, status) values
  ('BLOC_PPE', 'DRISS', 'mur', 'جدران بالبلوك — Driss Agglo', 'published'),
  ('BLOC_PPE', 'DRISS', 'plancher', 'سقف poutrelles/entrevous — Driss Agglo', 'published'),
  ('BLOC_PPE', 'DRISS', 'cloture', 'سور محدّد بالبلوك — Driss Agglo', 'published'),
  ('BLOC_PPE', 'SIREP', 'mur', 'جدران بالبلوك — SIREP-PREFA', 'draft'),
  ('BLOC_PPE', 'SIREP', 'plancher', 'سقف poutrelles/entrevous — SIREP-PREFA', 'draft')
on conflict do nothing;
