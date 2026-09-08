-- =====================================================================
-- 0030 — الكراء الحالي، والبناء بفلوس حاضرة
--
-- سؤالان كانا ناقصين وكلاهما يغيّر قراءة الملفّ:
--
-- 1) «إنت كاري؟ وبقدّاش؟» — الكراء الشهري هو الدليل العملي الوحيد على
--    ما يقدر المواطن يدفعه كلّ شهر: هو يدفعه فعلاً منذ سنين. وهو كذلك
--    عبء يزول يوم يملك، فلا يُحسب ضمن الأقساط الجارية التي تخصم من
--    القدرة — لذلك عمود مستقلّ لا خانة في financial_profiles.
--
-- 2) «فلوسي حاضرة» — من عنده التمويل جاهز لا يحتاج بنكاً ولا دراسة
--    قدرة على الاقتراض: يحتاج مقاولاً وعرضاً وبداية أشغال. مساره مختلف
--    من أوّل خطوة، فيستحقّ عموداً صريحاً لا استنتاجاً من financing_state.
-- =====================================================================

alter table social_assessments
  add column if not exists is_renting boolean not null default false;

alter table social_assessments
  add column if not exists rent_tnd numeric(10,2) check (rent_tnd >= 0);

comment on column social_assessments.rent_tnd is
  'الكراء الشهري — دليل على القدرة على الدفع، لا عبء يُخصم منها.';

alter table housing_requests
  add column if not exists cash_ready boolean not null default false;

comment on column housing_requests.cash_ready is
  'صرّح أنّ التمويل حاضر عنده — مسار بلا بنك.';

-- المسار السريع يستحقّ فهرساً: هذي الملفّات تُفتح أوّلاً
create index if not exists housing_requests_cash_ready_idx
  on housing_requests (cash_ready, created_at desc)
  where cash_ready;
