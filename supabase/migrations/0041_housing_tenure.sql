-- =====================================================================
-- 0041 — «وين تسكن؟» و«شنوّة يضايقك فيه؟» سؤالان لا سؤال واحد
--
-- كانت القائمة تخلط بُعدين لا علاقة لأحدهما بالآخر:
--
--   مسكن غير آمن أو مهدّد   ← حالة المسكن
--   مسكن ضيّق ومكتظّ         ← حالة المسكن
--   بالكراء وغير مستقرّ      ← صفة الحيازة + حالة
--   مع العائلة أو الأقارب    ← صفة الحيازة
--   بلا مسكن                ← صفة الحيازة
--
-- فالخيارات ليست متنافية: من يسكن مع أهله في مسكن ضيّق يجد جوابين
-- صحيحين ويختار واحداً، ونخسر النصف. ومن يكري مسكناً متصدّعاً يختار
-- «بالكراء» فيختفي التصدّع، أو «غير آمن» فتختفي حيازته.
--
-- هنا: الحيازة واحدة ومتنافية، والمشاكل متعدّدة ومجتمعة كما هي في
-- الواقع — المسكن يكون ضيّقاً وغالياً وبعيداً في آن.
--
-- وrent: كان سؤال «إنت كاري؟» منفصلاً يكرّر «بالكراء». صار الكراء
-- قيمة من قيم الحيازة، وis_renting يُشتقّ منها ولا يُسأل مرّتين.
-- =====================================================================

alter table social_assessments
  add column if not exists housing_problems text[] not null default '{}';

comment on column social_assessments.housing_problems is
  'ما يضايقه في مسكنه الحالي — متعدّد ومجتمع. الحيازة في housing_condition.';

-- ------------------------------------------------------------------
-- ما كان حالةً ينتقل إلى المشاكل، وما كان حيازةً يبقى.
-- القيد يُرفع أوّلاً: التحديث إلى القيم الجديدة يخرقه وهو قائم.
-- ------------------------------------------------------------------
alter table social_assessments
  drop constraint if exists social_assessments_housing_condition_check;

update social_assessments
   set housing_problems = case
         when housing_condition = 'unsafe'          then array['unsafe']
         when housing_condition = 'overcrowded'     then array['overcrowded']
         when housing_condition = 'rented_unstable' then array['unstable']
         else housing_problems
       end
 where housing_condition in ('unsafe', 'overcrowded', 'rented_unstable')
   and cardinality(housing_problems) = 0;

update social_assessments
   set housing_condition = case housing_condition
         when 'rented_unstable' then 'renting'
         -- لا نعرف حيازته: كان يجيب على سؤال آخر. «أخرى» أصدق من تخمين.
         when 'unsafe'          then 'other'
         when 'overcrowded'     then 'other'
         else housing_condition
       end
 where housing_condition in ('unsafe', 'overcrowded', 'rented_unstable');

-- من صرّح بالكراء في السؤال المنفصل تصير حيازته كراءً
update social_assessments
   set housing_condition = 'renting'
 where is_renting and (housing_condition is null or housing_condition = 'other');

alter table social_assessments
  add constraint social_assessments_housing_condition_check
  check (housing_condition in
    ('owner', 'renting', 'with_family', 'employer', 'temporary', 'homeless', 'other'));
