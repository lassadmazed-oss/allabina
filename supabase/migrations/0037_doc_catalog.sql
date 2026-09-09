-- =====================================================================
-- 0037 — دليل وثائق المطلب: كلّ مسار وأوراقه
--
-- كانت القائمة ستّة أسماء ثابتة في الكود تُعرض للجميع: من يبني فوق
-- أرضه ومن يشري شقّة يرون نفس الخانات. والحقيقة أنّ الأوراق تختلف
-- اختلافاً كاملاً: صاحب الأرض يحتاج شهادة صبغة ورخصة بناء، ومشتري
-- الشقّة يحتاج وعد بيع ونظام ملكية مشتركة، وطالب فوبرولوس يحتاج شهادة
-- عدم امتلاك مسكن. عرض ورقة لا تخصّ صاحب الملفّ يبعثه إلى البلدية
-- في سفرة بلا فائدة، وإخفاء ورقة يخصّه يوقّف ملفّه بعد شهر.
--
-- الدليل في القاعدة لا في الكود: الفريق يعرف الواقع الإداري أكثر من
-- أيّ قائمة نكتبها، ويصحّحها بلا نشر نسخة جديدة. وهذي الأوراق تتبدّل
-- بتبدّل المناشير.
-- =====================================================================

create table if not exists request_doc_catalog (
  code         text primary key,
  name_ar      text not null,
  name_fr      text,
  -- «علاش؟» — الفرق بين خانة تُملأ وخانة تُفهم
  why_ar       text,
  -- «وين تلقاها؟» — الجواب الذي يوفّر على المواطن نصف يوم
  issuer_ar    text,
  doc_group    text not null check (doc_group in
    ('identity','income','property','permits','social','support')),
  -- null = كلّ المسارات
  applies_to   request_type[],
  /**
   * شروط إضافية، كلّها معاً (AND). المعروفة اليوم:
   * employed · self_employed · retired · expat · needs_bank · cash_ready
   * renting · has_loans · foprolos · owns_land · disability · hardship
   */
  only_if      text[] not null default '{}',
  is_required  boolean not null default false,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

create index if not exists request_doc_catalog_order_idx
  on request_doc_catalog (doc_group, sort_order) where is_active;

alter table request_doc_catalog enable row level security;

drop policy if exists doc_catalog_public_read on request_doc_catalog;
create policy doc_catalog_public_read on request_doc_catalog
  for select to anon, authenticated using (is_active);

-- ------------------------------------------------------------------
-- الربط: السطر يحمل رمزاً ثابتاً بدل اسم عربي حرّ
-- ------------------------------------------------------------------
alter table request_documents add column if not exists doc_code text;

create unique index if not exists request_documents_code_idx
  on request_documents (request_id, doc_code) where doc_code is not null;

-- السطور القديمة كُتبت بالاسم العربي؛ نعطيها رموزها
update request_documents set doc_code = case doc_type
  when 'بطاقة تعريف'            then 'cin'
  when 'شهادة في العمل'          then 'work_cert'
  when 'كشف حساب بنكي'          then 'bank_statements'
  when 'رسم عقاري / عقد ملكية'   then 'land_title'
  when 'رخصة بناء'               then 'building_permit'
  when 'أمثلة ودراسات'           then 'arch_plans'
  else null end
where doc_code is null;

-- ------------------------------------------------------------------
-- البذرة: ما تطلبه البنوك والبلديات عادةً في تونس.
-- ليست نصّاً قانونياً — الفريق يصحّحها، والواجهة تقول ذلك صراحةً.
-- ------------------------------------------------------------------
insert into request_doc_catalog
  (code, name_ar, name_fr, why_ar, issuer_ar, doc_group, applies_to, only_if, is_required, sort_order)
values
  -- الهويّة ---------------------------------------------------------
  ('cin', 'بطاقة التعريف الوطنية', 'CIN',
   'كلّ ملفّ يبدا بيها.', 'مركز الأمن أو البلدية',
   'identity', null, '{}', true, 10),
  ('residence', 'شهادة إقامة', 'Certificat de résidence',
   'تثبّت المنطقة اللي تسكن فيها توّا.', 'العمادة أو البلدية',
   'identity', null, '{}', false, 20),
  ('civil_status', 'مضمون ولادة أو عقد زواج', 'Extrait de naissance / acte de mariage',
   'ملفّ السكن الاجتماعي يطلب الحالة المدنية.', 'البلدية',
   'identity', null, '{foprolos}', true, 30),

  -- الدخل -----------------------------------------------------------
  ('work_cert', 'شهادة في العمل', 'Attestation de travail',
   'تثبّت أنّك تخدم وقدّاش أقدميتك.', 'المشغّل',
   'income', null, '{employed}', true, 10),
  ('payslips', 'بطاقات الأجر (آخر 3 أشهر)', 'Bulletins de paie (3 derniers)',
   'البنك يحسب قدرتك على القسط منها.', 'المشغّل',
   'income', null, '{employed,needs_bank}', true, 20),
  ('bank_statements', 'كشوف الحساب البنكي (آخر 6 أشهر)', 'Relevés bancaires (6 mois)',
   'توري حركة مدخولك ومصاريفك.', 'البنك',
   'income', null, '{needs_bank}', true, 30),
  ('tax_return', 'التصريح بالضريبة', 'Déclaration d''impôt',
   'بديل بطاقة الأجر لمن يخدم لحسابه.', 'قباضة المالية',
   'income', null, '{self_employed,needs_bank}', true, 40),
  ('patente', 'بطاقة المعرّف الجبائي', 'Patente',
   'تثبّت نشاطك المستقلّ.', 'قباضة المالية',
   'income', null, '{self_employed}', false, 50),
  ('cnss', 'شهادة انخراط في الضمان الاجتماعي', 'Attestation CNSS / CNRPS',
   'شرط في فوبرولوس، وتقوّي الملفّ عند البنك.', 'الصندوق الوطني',
   'income', null, '{}', false, 60),
  ('loan_schedule', 'جدول الأقساط الجارية', 'Tableau d''amortissement',
   'باش نحسبو قدرتك الحقيقية بعد اللي تدفعو توّا.', 'البنك اللي عندو القرض',
   'income', null, '{has_loans}', false, 70),
  ('rent_contract', 'عقد الكراء الحالي', 'Contrat de location',
   'الكراء اللي تدفعو كلّ شهر أقوى دليل على قدرتك.', 'عندك أو عند المالك',
   'income', null, '{renting}', false, 80),
  ('funds_proof', 'إثبات توفّر المبلغ', 'Justificatif de fonds',
   'مسارك بلا بنك، فالمبلغ لازم يكون مثبَّتاً قبل الأشغال.', 'البنك أو شهادة ادّخار',
   'income', null, '{cash_ready}', true, 90),

  -- العقار ----------------------------------------------------------
  ('land_title', 'رسم عقاري أو عقد ملكية', 'Titre foncier / acte de propriété',
   'يثبّت أنّ الأرض متاعك وأنّها تتبنى.', 'إدارة الملكية العقارية',
   'property', '{build_on_land,renovation}', '{}', true, 10),
  ('ownership_cert', 'شهادة ملكية حديثة', 'Certificat de propriété récent',
   'تثبّت أنّ الوضعية ما تبدّلتش (رهن، تفويت، نزاع).', 'إدارة الملكية العقارية',
   'property', '{build_on_land,renovation}', '{}', false, 20),
  ('urbanism_cert', 'شهادة صبغة الأرض', 'Certificat d''urbanisme',
   'تقول إذا الأرض صالحة للبناء وشنوّة مسموح فيها. بلاها كلّ شي يوقف.',
   'البلدية', 'property', '{build_on_land,land_and_house}', '{}', true, 30),
  ('site_plan', 'مثال موقعي', 'Plan de situation',
   'يبيّن موقع الأرض بالضبط.', 'مهندس مساحة',
   'property', '{build_on_land,land_and_house}', '{}', false, 40),
  ('topo_survey', 'رفع طوبوغرافي', 'Levé topographique',
   'يلزم قبل الأمثلة الهندسية.', 'مهندس مساحة',
   'property', '{build_on_land}', '{}', false, 50),
  ('sale_promise', 'وعد بيع', 'Promesse de vente',
   'إذا لقيت العقار وتفاهمت مع صاحبه.', 'البائع أو عدل الإشهاد',
   'property', '{land_and_house,apartment,economic}', '{}', false, 60),
  ('copro_rules', 'نظام الملكية المشتركة', 'Règlement de copropriété',
   'يقول شنوّة متاعك وشنوّة مشترك في العمارة.', 'الباعث العقاري',
   'property', '{apartment,economic}', '{}', false, 70),
  ('tax_clearance', 'براءة ذمّة من الأداءات البلدية', 'Quitus fiscal',
   'تثبّت أنّ العقار ما عليهش ديون بلدية.', 'البلدية',
   'property', '{land_and_house,apartment,economic}', '{}', false, 80),
  ('rto_contract', 'عقد الكراء المملّك', 'Contrat de location-vente',
   'العقد اللي يحوّل الكراء إلى ملكية.', 'الباعث العقاري',
   'property', '{rent_to_own}', '{}', false, 90),

  -- الرخص -----------------------------------------------------------
  ('arch_plans', 'الأمثلة الهندسية', 'Plans d''architecte',
   'مدخل رخصة البناء وأساس حساب الكلفة.', 'مهندس معماري',
   'permits', '{build_on_land}', '{}', true, 10),
  ('building_permit', 'رخصة البناء', 'Permis de bâtir',
   'بلاها الأشغال غير قانونية.', 'البلدية',
   'permits', '{build_on_land}', '{}', true, 20),
  ('renovation_permit', 'رخصة ترميم أو توسعة', 'Autorisation de travaux',
   'حتى الترميم الكبير يطلب رخصة.', 'البلدية',
   'permits', '{renovation}', '{}', false, 30),

  -- السكن الاجتماعي -------------------------------------------------
  ('non_property_cert', 'شهادة عدم امتلاك مسكن', 'Attestation de non-propriété',
   'شرط أساسي في فوبرولوس.', 'إدارة الملكية العقارية',
   'social', null, '{foprolos}', true, 10),
  ('salary_ceiling_cert', 'شهادة أجر تثبّت الدخل تحت السقف', 'Attestation de salaire',
   'فوبرولوس يشترط سقفاً للدخل.', 'المشغّل',
   'social', null, '{foprolos,employed}', true, 20),

  -- المساندة --------------------------------------------------------
  ('omda_cert', 'شهادة من العمدة', 'Attestation de l''omda',
   'تثبّت الوضعية الاجتماعية للفريق وللشركاء.', 'العمادة',
   'support', null, '{hardship}', false, 10),
  ('disability_card', 'بطاقة إعاقة', 'Carte de handicap',
   'تفتح حقوقاً وتغيّر ترتيب الأولوية.', 'وزارة الشؤون الاجتماعية',
   'support', null, '{disability}', false, 20),
  ('social_aid_card', 'بطاقة علاج مجاني أو تخفيض', 'Carte de soins',
   'مؤشّر على الوضعية الاجتماعية.', 'الشؤون الاجتماعية',
   'support', null, '{hardship}', false, 30)
on conflict (code) do nothing;
