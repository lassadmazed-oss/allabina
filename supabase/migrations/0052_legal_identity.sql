-- ============================================================
-- 0052_legal_identity.sql · هويّة الشركة القانونية ورقم الاتّصال
-- ============================================================
-- الموقع كان يقول «نسخة تجريبية» وبرّا: لا معرّف وحيد، لا سجلّ، لا شكل
-- قانوني، لا عنوان، ولا حتّى رقم هاتف. وحريف يحبّ يبني دار بمئة ألف
-- دينار يسأل أوّل سؤال: «شكون انتوما؟». الجواب موجود في مضمون السجلّ
-- الوطني للمؤسّسات، فنحطّوه في القاعدة لا في الشفرة حتّى يتبدّل من
-- اللوحة بلا إعادة نشر.
--
-- ما نخزّنوش هنا: رقم التثبّت من السجلّ ولا عدد المضمون. هما مفتاحان
-- يفتحان المضمون الكامل (فيه اسم الوكيل ووضعيته الجبائية) لأيّ شخص
-- ينسخهما — فنشرهما على الموقع يعطي أكثر ممّا تقتضيه المعاملة.
--
-- المصدر: مضمون السجلّ الوطني للمؤسّسات، مستخرَج يوم 30 أكتوبر 2026.
-- ============================================================

insert into app_settings (key, value, description) values
  ('legal.name_ar', '"اللَّبنة للبناء والإعمار"'::jsonb,
   'الاسم الاجتماعي كما في السجلّ الوطني للمؤسّسات'),
  ('legal.name_fr', '"LABINA POUR LA CONSTRUCTION ET LA RECONSTITUTION"'::jsonb,
   'Dénomination sociale — RNE'),
  ('legal.form_ar', '"شركة ذات مسؤولية محدودة"'::jsonb, 'الشكل القانوني'),
  ('legal.form_fr', '"Société à responsabilité limitée (SARL)"'::jsonb, 'Forme juridique'),
  ('legal.unique_id', '"2005254J"'::jsonb,
   'المعرّف الوحيد — هو نفسه المعرّف الجبائي، يُعرض علناً'),
  ('legal.register_no', '"B50585752026"'::jsonb,
   'عدد التصرّف الداخلي في السجلّ الوطني للمؤسّسات'),
  ('legal.capital_tnd', '150000'::jsonb, 'رأس المال بالدينار'),
  ('legal.activity_code', '"4521"'::jsonb, 'رمز النشاط الرئيسي'),
  ('legal.activity_ar', '"أشغال البناء — مقاولات بناء"'::jsonb, 'النشاط الرئيسي'),
  ('legal.activity_fr', '"Travaux de construction — entreprise de bâtiment"'::jsonb,
   'Activité principale'),
  ('legal.address_ar',
   '"شارع الهادي نويرة، عمارة لاكورون، الطابق السادس، مكتب ب02 — صفاقس المدينة 3027"'::jsonb,
   'المقرّ الاجتماعي'),
  ('legal.address_fr',
   '"Avenue Hédi Nouira, Immeuble La Couronne, 6e étage, B02 — 3027 Sfax Ville"'::jsonb,
   'Siège social'),
  ('legal.published_on', '"2026-10-29"'::jsonb, 'تاريخ الإشهار'),
  ('legal.activity_since', '"2026-10-05"'::jsonb, 'تاريخ بداية النشاط'),
  ('legal.manager', '""'::jsonb,
   'الممثّل القانوني (الوكيل) — يُعرض إن عُمِّر، ويُترك فارغاً فلا يظهر سطره'),
  ('legal.rne_verify_url', '"https://registre-entreprises.tn/rne-public"'::jsonb,
   'موقع السجلّ للتثبّت — بلا رمز تثبّت، التثبّت يتمّ بالمعرّف الوحيد')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- رقم الاتّصال العمومي: كان 98124111 وما كان يظهر إلّا في صفحة شكر
-- المتدخّلين. يتبدّل ويصير معروضاً في كلّ صفحة.
update app_settings set value = '"98120630"'::jsonb, updated_at = now()
where key in ('contact.phone', 'contact.whatsapp');

insert into app_settings (key, value, description) values
  ('contact.phone', '"98120630"'::jsonb, 'هاتف المنصّة — يُعرض في الذيل وصفحات الشكر'),
  ('contact.whatsapp', '"98120630"'::jsonb, 'واتساب المنصّة — يُعرض في الذيل وصفحات الشكر')
on conflict (key) do nothing;
