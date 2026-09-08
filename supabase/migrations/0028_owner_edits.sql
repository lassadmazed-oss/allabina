-- =====================================================================
-- 0028 — صاحب المطلب يزيد ويعدّل في مطلبه
--
-- كان المطلب يُرسَل مرّة واحدة ثمّ يصير ملك الإدارة: من نسي دخله
-- الحقيقي أو تبدّل رقمه أو ولد له ولد يحتاج غرفة زائدة ما عندو باب
-- غير أن يبعث مطلباً جديداً — فيصير في القاعدة ملفّان لنفس المواطن.
--
-- هنا نفتح له الباب، ونسجّل كلّ تعديل: من عدّل، متى، وشنوّة تبدّل.
-- =====================================================================

-- آخر تعديل من صاحب المطلب — تميّزه الإدارة عن تعديلاتها هي
alter table housing_requests add column if not exists owner_updated_at timestamptz;

create table if not exists request_edits (
  id           bigserial primary key,
  request_id   uuid not null references housing_requests(id) on delete cascade,
  -- { "monthlyIncome": { "from": 1200, "to": 1500 }, ... }
  changes      jsonb not null,
  -- التنقيط قبل وبعد: التعديل في الدخل يحرّك الصنف، ولازم يبان لماذا
  score_before smallint,
  score_after  smallint,
  band_before  text,
  band_after   text,
  created_at   timestamptz not null default now()
);

create index if not exists request_edits_request_idx
  on request_edits (request_id, created_at desc);

alter table request_edits enable row level security;
-- بلا policy: لا أحد يصل إليها بمفتاح publishable. الخادم بالمفتاح
-- السرّي وحده يكتب ويقرأ.

/**
 * سجلّ تدقيق: يُكتب ولا يُعدَّل.
 *
 * الحذف مسموح عمداً — بلا هذا يستحيل حذف مطلب بطلب صاحبه (الحقّ في
 * المحو)، وهذا بالضبط ما وقع في دفتر المساندة واحتاج 0018 لإصلاحه.
 * الحذف هنا لا يجي إلّا تسلسلاً من حذف المطلب نفسه.
 */
create or replace function request_edits_no_update() returns trigger
language plpgsql as $$
begin
  raise exception 'request_edits سجلّ تدقيق: التعديل ممنوع';
end;
$$;

drop trigger if exists request_edits_no_update on request_edits;
create trigger request_edits_no_update
  before update on request_edits
  for each row execute function request_edits_no_update();
