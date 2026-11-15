-- ============================================================
-- 0074_contracting_first.sql · الشركة تظهر مقاولاتٍ من أوّل شاشة
-- ============================================================
-- قرار 15/11/2026: الحريف يدخل، يعمّر، يشوف، يختار — وفي آخر مرحلة
-- يعطي اسمه ورقمه ويبعث. ولا يُسأل «شنوّة مشكلتك» ولا «قدّاش عندك
-- فلوس»: شركة تبني لا تحقّق في أحوال الناس، والسؤال الذي لا يبدّل
-- شيئاً في الشغل يكلّف مواطناً يترك الاستمارة.
--
-- وما بُني للمساندة والعقارات والشبكة لا يُحذف — يُخبّى خلف مفتاح
-- يُقلب من اللوحة يوم يُستحقّ.
-- ============================================================

insert into app_settings (key, value, description) values
  ('intake.profile', '"contracting"'::jsonb,
   'صورة الاستمارة: contracting = مقاولات (بلا عائلة ولا دخل ولا «أكبر عائق») · full = الصورة الكاملة')
on conflict (key) do nothing;

-- المساندة والمحاكي ينضمّان للمخبّأ، بلا دهس ما خبّاه الفريق غيرهما:
-- الإضافة لا الاستبدال — وقائمةٌ بلا تكرار.
update app_settings
set value = (
  select jsonb_agg(distinct x)
  from jsonb_array_elements_text(
    case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
    || '["soutien", "simulateur"]'::jsonb
  ) as t(x)
),
updated_at = now()
where key = 'site.hidden_paths';

insert into app_settings (key, value, description) values
  ('site.hidden_paths',
   '["proprietaire", "reseau", "standing", "soutien", "simulateur"]'::jsonb,
   'مسارات الموقع العمومي المخبّأة. القيم الممكنة: proprietaire · reseau · standing · soutien · simulateur · systemes.')
on conflict (key) do nothing;
