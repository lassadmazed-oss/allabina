-- الوكيل باللغتين.
--
-- كلّ حقل قانوني في «المعطيات المرجعية» زوجٌ: name_ar/name_fr،
-- form_ar/form_fr، activity_ar/activity_fr، address_ar/address_fr.
-- الوكيل وحده كان فرداً — فاسمٌ بالعربية يظهر في صفحة المعطيات
-- القانونية الفرنسية كما هو، واسمٌ بالحرف اللاتيني يظهر في العربية.
--
-- والمفتاح القديم legal.manager لا يُحذف: يبقى يُقرأ احتياطاً للعربية
-- إذا كان الجديد فارغاً، فلا يسقط ما كُتب قبل هذا الترحيل.
-- ============================================================

insert into app_settings (key, value, description) values
  ('legal.manager_ar', '""'::jsonb, 'الممثّل القانوني (الوكيل) — بالعربية'),
  ('legal.manager_fr', '""'::jsonb, 'Représentant légal (gérant) — en caractères latins')
on conflict (key) do nothing;

-- نقل ما كُتب في المفتاح الفرد إلى العربية، مرّةً واحدة
update app_settings s
   set value = (select value from app_settings where key = 'legal.manager')
 where s.key = 'legal.manager_ar'
   and coalesce(s.value #>> '{}', '') = ''
   and coalesce(
         (select value #>> '{}' from app_settings where key = 'legal.manager'),
         ''
       ) <> '';
