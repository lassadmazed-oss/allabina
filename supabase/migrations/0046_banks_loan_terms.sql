-- ============================================================
-- 0046_banks_loan_terms.sql · البنوك التونسية ومدّة التمويل التي يختارها الحريف
-- ============================================================
-- الحريف يختار في الاستمارة وفي المحاكي مدّة التمويل (5→25 سنة) والبنك الذي
-- يفكّر فيه، والتقدير يُحسب بهما.
--
-- أسماء البنوك حقائق تُكتب هنا. أمّا الشروط — النسبة، المدّة القصوى، نسبة
-- التمويل — فلا تُثبَّت في الشيفرة: الأعمدة فارغة ويسجّلها الفريق من
-- «المعطيات المرجعية» بمصدرها وتاريخها. بنك بلا شروط مسجّلة يُحسب بالفرضية
-- العامّة، والواجهة تقول ذلك صراحةً.
-- ============================================================

create table if not exists banks (
  code                text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  name_ar             text not null,
  name_fr             text not null,
  is_islamic          boolean not null default false,
  sort_order          int not null default 100,
  is_active           boolean not null default true,
  indicative_rate_pct numeric(5,2) check (indicative_rate_pct is null or indicative_rate_pct between 0 and 30),
  max_years           int check (max_years is null or max_years between 1 and 30),
  max_share_pct       numeric(5,2) check (max_share_pct is null or max_share_pct between 0 and 100),
  terms_source        text,
  terms_verified_at   date,
  updated_by          uuid references auth.users(id),
  updated_at          timestamptz not null default now()
);

comment on table banks is
  'البنوك التونسية المعروضة للاختيار؛ الشروط التقديرية فارغة ما لم يسجّلها الفريق بمصدر';

insert into banks (code, name_ar, name_fr, is_islamic, sort_order) values
  ('bh',       'بنك الإسكان (BH Bank)',                'BH Bank',            false, 10),
  ('stb',      'الشركة التونسية للبنك (STB)',          'STB',                false, 20),
  ('bna',      'البنك الوطني الفلاحي (BNA)',           'BNA',                false, 30),
  ('biat',     'بنك تونس العربي الدولي (BIAT)',        'BIAT',               false, 40),
  ('attijari', 'التجاري بنك (Attijari)',               'Attijari Bank',      false, 50),
  ('amen',     'بنك الأمان (Amen Bank)',               'Amen Bank',          false, 60),
  ('bt',       'بنك تونس (BT)',                        'Banque de Tunisie',  false, 70),
  ('uib',      'الاتّحاد الدولي للبنوك (UIB)',          'UIB',                false, 80),
  ('ubci',     'الاتّحاد البنكي للتجارة والصناعة (UBCI)', 'UBCI',             false, 90),
  ('atb',      'البنك العربي لتونس (ATB)',             'ATB',                false, 100),
  ('btk',      'بنك تونس والكويت (BTK)',               'BTK Bank',           false, 110),
  ('qnb',      'بنك قطر الوطني تونس (QNB)',            'QNB Tunisia',        false, 120),
  ('bte',      'بنك تونس والإمارات (BTE)',             'BTE',                false, 130),
  ('zitouna',  'بنك الزيتونة',                          'Banque Zitouna',     true,  140),
  ('albaraka', 'بنك البركة',                            'Al Baraka Bank',     true,  150),
  ('wifak',    'الوفاق الدولي للبنوك',                  'Wifak Bank',         true,  160)
on conflict (code) do nothing;

-- ما سجّله الفريق سابقاً لصيغة «تمويل بناء» عند الزيتونة يُنقل كما هو، بمصدره
update banks
   set max_years = 20,
       max_share_pct = 80,
       terms_source = 'منقول من صيغ التمويل المسجّلة (financing_products) — يحتاج تثبّتاً من البنك'
 where code = 'zitouna'
   and max_years is null
   and max_share_pct is null
   and indicative_rate_pct is null;

-- ما اختاره الحريف: مدّة التمويل بالسنوات والبنك الذي يفكّر فيه
alter table financial_profiles
  add column if not exists loan_years smallint check (loan_years between 1 and 30);
alter table financial_profiles
  add column if not exists bank_code text references banks(code) on update cascade on delete set null;

comment on column financial_profiles.loan_years is 'مدّة التمويل التي اختارها الحريف في الاستمارة (null = لم يختر)';
comment on column financial_profiles.bank_code is 'البنك الذي يفكّر فيه الحريف (null = لم يختر)';

-- قراءة عمومية للبنوك النشطة (أسماء وشروط تقديرية معلنة)، والكتابة للخادم وحده
alter table banks enable row level security;
drop policy if exists banks_public_read on banks;
create policy banks_public_read on banks
  for select to anon, authenticated using (is_active);

notify pgrst, 'reload schema';
