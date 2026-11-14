-- ============================================================
-- مطابقة الأرقام: عمود محسوب بدل البحث بالتخمين
-- ============================================================
-- الهاتف في الملفّات القديمة محفوظ كما كتبه صاحبه: «98124111» و
-- «+21650513948» و«58 41 55 01». ومطالبة الحريف بملفّه بعد تحقّق رقمه
-- تحتاج مطابقة، والمطابقة بـlike أو بـregexp عند كلّ استعلام بطيئة
-- وتُخطئ.
--
-- فعمود محسوب مخزَّن يحمل الأعداد وحدها، ومفهرس. المقارنة تصير بقائمة
-- صيغ معروفة (21698120630 · 98120630 · 0021698120630) لا بتخمين.
--
-- `generated always … stored`: يُحسب عند الكتابة لا عند القراءة، ولا
-- يُكتب باليد، فلا ينفصل عن الهاتف أبداً.

alter table housing_requests
  add column if not exists phone_digits text
  generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored;

alter table properties
  add column if not exists phone_digits text
  generated always as (nullif(regexp_replace(coalesce(owner_phone, ''), '\D', '', 'g'), '')) stored;

create index if not exists housing_requests_phone_digits_idx on housing_requests (phone_digits);
create index if not exists properties_phone_digits_idx       on properties (phone_digits);

comment on column housing_requests.phone_digits is
  'أعداد الهاتف وحدها — مفتاح المطابقة عند مطالبة الحريف بملفّه. محسوب لا يُكتب.';
