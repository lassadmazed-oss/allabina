-- ============================================================
-- 0014_zones.sql · المناطق المتعارف عليها
-- ============================================================
-- «وين الأرض؟» — المواطن ما يجاوبش بالعمادة الرسمية، يجاوب
-- «قرمدة»، «الأفران»، «العين»، «طريق تنيور». هذي أسماء متداولة
-- لا إدارية، فلها جدولها الخاصّ بجانب delegations و imadas.
--
-- الاستعمال: اقتراحات في خانة الموقع، والكتابة الحرّة تبقى مفتوحة —
-- المنطقة اللي ما هيش في القائمة تتكتب كما هي ولا تُرفض.
--
-- تنبيه للفريق: هذي البذرة نقطة انطلاق مبنية على الاستعمال الشائع،
-- موش قائمة رسمية. راجعوها من الـBack-office: زيدوا، احذفوا، واربطوا
-- كلّ منطقة بمعتمديتها. delegation_id متروك فارغاً عمداً حتى لا نثبّت
-- ربطاً غير متثبَّت منه.
-- ============================================================

create table if not exists zones (
  id            serial primary key,
  gov_code      text not null references governorates(code),
  delegation_id int references delegations(id) on delete set null,
  name_ar       text not null,
  name_fr       text,
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists zones_unique_idx on zones (gov_code, name_ar);
create index if not exists zones_lookup_idx on zones (gov_code, is_active, sort_order);

drop trigger if exists zones_touch on zones;
create trigger zones_touch before update on zones
  for each row execute function touch_updated_at();

comment on table zones is
  'مناطق متداولة تُقترح في خانة الموقع — ليست تقسيماً إدارياً، وتُدار من الـBack-office';

insert into zones (gov_code, name_ar, name_fr, sort_order) values
  ('SFX', 'المدينة العتيقة',   'Médina',             1),
  ('SFX', 'باب بحر',           'Bab Bhar',           2),
  ('SFX', 'باب جبلي',          'Bab Jebli',          3),
  ('SFX', 'باب الديوان',       'Bab Diwan',          4),
  ('SFX', 'بحري',              'Bahri',              5),
  ('SFX', 'الجزيرة',           'El Jazira',          6),
  ('SFX', 'صفاقس الجديدة',     'Sfax El Jadida',     7),
  ('SFX', 'المنشية',           'El Manchia',         8),
  ('SFX', 'قرمدة',             'Gremda',             9),
  ('SFX', 'الأفران',           'El Afrane',         10),
  ('SFX', 'العين',             'El Ain',            11),
  ('SFX', 'شيحية',             'Chihia',            12),
  ('SFX', 'الحاجب',            'El Hajeb',          13),
  ('SFX', 'مرج الزهور',        'Merj Ezzouhour',    14),
  ('SFX', 'بوعسيدة',           'Bouassida',         15),
  ('SFX', 'الشعبونة',          'Chaabouna',         16),
  ('SFX', 'المحاسن',           'El Mahassen',       17),
  ('SFX', 'سكرة',              'Sakiet',            18),
  ('SFX', 'تنيور',             'Teniour',           19),
  ('SFX', 'سيدي منصور',        'Sidi Mansour',      20),
  ('SFX', 'طريق تنيور',        'Route Teniour',     21),
  ('SFX', 'طريق قرمدة',        'Route Gremda',      22),
  ('SFX', 'طريق الأفران',      'Route El Afrane',   23),
  ('SFX', 'طريق العين',        'Route El Ain',      24),
  ('SFX', 'طريق المهدية',      'Route Mahdia',      25),
  ('SFX', 'طريق قابس',         'Route Gabès',       26),
  ('SFX', 'طريق تونس',         'Route Tunis',       27),
  ('SFX', 'طريق منزل شاكر',    'Route Menzel Chaker', 28),
  ('SFX', 'طريق سكرة',         'Route Sakiet',      29),
  ('SFX', 'طريق المطار',       'Route Aéroport',    30)
on conflict (gov_code, name_ar) do nothing;

alter table zones enable row level security;

drop policy if exists zones_public_read on zones;
create policy zones_public_read on zones
  for select to anon, authenticated using (is_active = true);
