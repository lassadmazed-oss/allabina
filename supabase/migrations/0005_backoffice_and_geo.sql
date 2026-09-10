-- ============================================================
-- 0005_backoffice_and_geo.sql
--   1) الجغرافيا: ولاية ← معتمدية ← عمادة ← موقع الأرض
--   2) الفرضيات البنكية: متغيّرات لا أرقام مثبّتة
--   3) الـBack-office: متابعة الحريف من أوّل استفسار إلى الإنجاز
-- ============================================================

-- ============================================================
-- 1) الجغرافيا
-- ============================================================

-- معتمديات صفاقس حسب تقسيم وزارة الداخلية — 16 معتمدية.
-- الإدراج في 0002. هنا ننظّف المعتمديات القديمة فقط، وبشرطين:
--   1) ليست ضمن القائمة الرسمية
--   2) لا يشير إليها أيّ مطلب — حتى لا تُكسر مراجع الحرفاء ولا تتبدّل المعرّفات
delete from delegations d
where d.gov_code = 'SFX'
  and d.name_ar not in (
    'صفاقس المدينة','صفاقس الشمالية','صفاقس الجنوبية','ساقية الزيت','ساقية الداير','طينة',
    'عقارب','جبنيانة','العامرة','الحنشة','منزل شاكر','الغريبة','بئر علي بن خليفة','الصخيرة',
    'المحرس','قرقنة'
  )
  and not exists (select 1 from housing_requests r where r.delegation_id = d.id);

-- العمادات: المستوى الثالث. تُملأ من الـBack-office أو باستيراد قائمة
-- وزارة الداخلية — لا تُخترع أسماء هنا.
create table if not exists imadas (
  id            serial primary key,
  delegation_id int not null references delegations(id) on delete cascade,
  name_ar       text not null,
  code          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (delegation_id, name_ar)
);

create index if not exists imadas_delegation_idx on imadas (delegation_id);

-- موقع الأرض على مستوى المطلب
alter table housing_requests add column if not exists imada_id      int references imadas(id);
alter table housing_requests add column if not exists land_location text;   -- حيّ، نهج، معلم قريب
alter table housing_requests add column if not exists land_lat      numeric(9,6);
alter table housing_requests add column if not exists land_lng      numeric(9,6);

create index if not exists housing_requests_geo_idx
  on housing_requests (gov_code, delegation_id, imada_id);

-- ============================================================
-- 2) الفرضيات البنكية والمالية — متغيّرات، لا أرقام مثبّتة
-- ============================================================
-- هامش الربح/نسبة التمويل المرجعية، سقف الاستدانة، مدّة التمويل،
-- المساهمة الذاتية، مصاريف التسجيل والتأمين والضمانات والمصاريف
-- البنكية: تُحدَّد وفق الشروط المعمول بها لدى بنك الزيتونة والمؤسّسات
-- البنكية التونسية، ووفق التشريع والترتيبات الجاري بها العمل بتاريخ
-- إسناد التمويل. لذلك تُفرَّغ القيم الرقمية المؤقّتة من الإعدادات.

update app_settings set value = null, updated_at = now()
  where key in (
    'finance.annual_rate_pct',
    'finance.max_dti_pct',
    'finance.max_years',
    'finance.registration_fees_pct',
    'finance.insurance_pct'
  );

update app_settings set
  description = 'يُحدَّد وفق شروط البنك والتشريع الجاري به العمل بتاريخ إسناد التمويل — لا يُثبَّت في المنصة'
  where key like 'finance.%' and key <> 'finance.validated' and key <> 'finance.vat_pct';

insert into app_settings (key, value, description) values
  ('finance.terms_note',
   '"يتم تحديد هامش الربح/نسبة التمويل المرجعية، سقف الاستدانة، مدة التمويل، المساهمة الذاتية، مصاريف التسجيل والتأمين والضمانات والمصاريف البنكية وفق الشروط المعمول بها لدى بنك الزيتونة والمؤسسات البنكية التونسية، ووفق التشريع والترتيبات الجاري بها العمل بتاريخ إسناد التمويل."'::jsonb,
   'النصّ الذي يُعرض تحت كلّ نتيجة تمويل'),
  ('finance.mode', '"scenario"'::jsonb,
   'scenario = المحاكي يشتغل بفرضيات يضبطها المستعمل ولا يعرض أرقاماً كأنها شروط بنكية'),
  ('scoring.assumption_note', '"فرضيات داخلية للترتيب فقط — لا تُعرض للحريف ولا تمثّل شروط تمويل"'::jsonb,
   'التنقيط يحتاج فرضية موحّدة ليرتّب المطالب فيما بينها'),
  ('scoring.assumed_rate_pct', '8'::jsonb, 'فرضية ترتيب داخلية — نسبة سنوية'),
  ('scoring.assumed_dti_pct', '40'::jsonb, 'فرضية ترتيب داخلية — سقف الاستدانة'),
  ('scoring.assumed_years', '20'::jsonb, 'فرضية ترتيب داخلية — مدّة التمويل'),
  ('scoring.assumed_fees_pct', '0'::jsonb, 'فرضية ترتيب داخلية — مصاريف إضافية (0 = لا تُحتسب)')
on conflict (key) do update
  set value = excluded.value, description = excluded.description, updated_at = now();

-- منتجات التمويل: مرجع قابل للتحيين من الـBack-office
create table if not exists financing_products (
  id             serial primary key,
  bank           text not null,
  name           text not null,
  target         text not null check (target in ('individual','professional')),
  purpose        text,                       -- بناء، اقتناء، مشروع عقاري…
  max_share_pct  numeric(5,2),               -- أقصى نسبة تمويل من الكلفة
  max_years      int,                        -- أقصى مدّة
  own_share_note text,                       -- المساهمة الذاتية
  conditions     text,
  source         text,                       -- من أين جاءت المعلومة
  verified_at    date,                       -- آخر تثبّت
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (bank, name)
);

insert into financing_products
  (bank, name, target, purpose, max_share_pct, max_years, own_share_note, conditions, source, verified_at)
values
  ('بنك الزيتونة', 'تمويل بناء', 'individual', 'البناء على أرض على الملك', 80, 20,
   'الباقي مساهمة ذاتية',
   'النسب والمدد والشروط المالية تُحدَّد من البنك حسب الملفّ والتشريع الجاري به العمل بتاريخ إسناد التمويل.',
   'معطيات مقدَّمة من فريق اللَّبنة — تحتاج تثبّتاً من البنك', null),
  ('بنك الزيتونة', 'تمويل مشاريع عقارية', 'professional', 'المشاريع العقارية للمهنيين', 70, null,
   'الباقي أموال ذاتية',
   'النسب والشروط تُحدَّد من البنك حسب المشروع والتشريع الجاري به العمل.',
   'معطيات مقدَّمة من فريق اللَّبنة — تحتاج تثبّتاً من البنك', null)
on conflict (bank, name) do nothing;

-- ============================================================
-- 3) الـBack-office: متابعة الحريف
-- ============================================================

-- الإجراء الواجب اتخاذه لكلّ ملفّ
alter table housing_requests add column if not exists next_action     text;
alter table housing_requests add column if not exists next_action_at  date;
alter table housing_requests add column if not exists assigned_to     uuid references auth.users(id);
alter table housing_requests add column if not exists financing_id    int references financing_products(id);

create index if not exists housing_requests_next_action_idx
  on housing_requests (next_action_at) where next_action_at is not null;

-- الأسئلة والمشاكل والاعتراضات والطلبات الخاصة
do $$ begin
  create type interaction_kind as enum ('question','issue','objection','special_request','call','note');
exception when duplicate_object then null; end $$;

create table if not exists request_interactions (
  id          bigserial primary key,
  request_id  uuid not null references housing_requests(id) on delete cascade,
  kind        interaction_kind not null default 'note',
  body        text not null,
  answer      text,
  resolved    boolean not null default false,
  actor       uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists request_interactions_request_idx
  on request_interactions (request_id, created_at desc);
create index if not exists request_interactions_open_idx
  on request_interactions (resolved) where resolved = false;

-- الوثائق المتوفّرة (تسجيل التوفّر فقط، بلا رفع ملفّات في هذه المرحلة)
create table if not exists request_documents (
  id          bigserial primary key,
  request_id  uuid not null references housing_requests(id) on delete cascade,
  doc_type    text not null,      -- بطاقة تعريف، شهادة في العمل، رسم عقاري، رخصة بناء…
  available   boolean not null default false,
  note        text,
  updated_at  timestamptz not null default now(),
  unique (request_id, doc_type)
);

-- RLS على الجداول الجديدة: الفريق فقط، ولا شيء لدور anon
alter table imadas               enable row level security;
alter table financing_products   enable row level security;
alter table request_interactions enable row level security;
alter table request_documents    enable row level security;

drop policy if exists imadas_public_read on imadas;
create policy imadas_public_read on imadas for select to anon, authenticated using (true);

drop policy if exists financing_products_public_read on financing_products;
create policy financing_products_public_read on financing_products
  for select to anon, authenticated using (is_active);

do $$
declare t text;
begin
  foreach t in array array['request_interactions','request_documents']
  loop
    execute format('drop policy if exists %I_staff_read on %I', t, t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_staff())', t, t);
  end loop;
end $$;
