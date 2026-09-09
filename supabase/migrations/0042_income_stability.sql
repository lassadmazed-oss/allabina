-- =====================================================================
-- 0042 — استقرار الدخل: عن انتظامه لا عن مقداره
--
-- القائمة القديمة: بلا دخل · غير قارّ · قارّ لكن **ضعيف** · أخرى.
-- ثلاث علل:
--   1. ما فيهاش خانة لأجر قارّ عادي، فصاحب الأجر المحترم يختار «أخرى»
--      — وهي أكثر خانة تُملأ في قائمة سيّئة.
--   2. «ضعيف» حكم على الناس، والمقدار يُسأل في خطوة الدخل أصلاً.
--   3. تخلط الانتظام بالمقدار، وهما بُعدان يقرؤهما البنك مستقلّين:
--      موسميّ بدخل عالٍ ملفّه أصعب من موظّف بأجر أقلّ.
--
-- القيد نسيناه في 0041 فبقي يرفض القيم الجديدة بصمت: الاستمارة تُرسَل
-- والمطلب يُسجَّل، وسطر «المسار الاجتماعي» وحده لا يُكتب.
-- =====================================================================

alter table social_assessments
  drop constraint if exists social_assessments_income_stability_check;

-- «قارّ لكن ضعيف»: الانتظام شهريّ ثابت، والضعف كان حكماً لا معطى
update social_assessments set income_stability = 'monthly_fixed'
 where income_stability = 'low_stable';

-- «أخرى» لا تُترجم: ما كنّا نعرف ماذا تعني، والتخمين أسوأ من الفراغ
update social_assessments set income_stability = null
 where income_stability = 'other';

alter table social_assessments
  add constraint social_assessments_income_stability_check
  check (income_stability in
    ('monthly_fixed', 'monthly_variable', 'seasonal', 'irregular', 'none'));
