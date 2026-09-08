-- ============================================================
-- 0020_request_files.sql · ملفّات وثائق المطلب
-- ============================================================
-- request_documents (0005) قائمة تحقّق: «بطاقة التعريف متوفّرة؟ نعم».
-- هنا الملفّ نفسه: صورة البطاقة، نسخة الرسم العقاري، شهادة العمل.
--
-- الفرق الجوهري عن صور الحالات المنجزة (0019): هذي وثائق شخصية.
--   · المخزن خاصّ — لا رابط عمومي أبداً. الوصول برابط موقّع قصير العمر
--     يولّده الخادم لعضو فريق مصادَق عليه فقط.
--   · لا يقرأها anon، ولا authenticated من غير الفريق.
--   · تُحذف مع مطلبها: المحو بطلب صاحب المعطيات يمحو وثائقه معه.
--   · بلا وسم is_demo: بيانات التجربة ما تحتاجش وثائق حقيقية، والوثيقة
--     الحقيقية ما تتشابهش مع تجريبية.
-- ============================================================

-- ---------- المخزن الخاصّ ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-documents', 'request-documents', false,
  15728640,                                                    -- 15 MiB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,                              -- لا يُفتح سهواً
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- الملفّات ----------
create table if not exists request_files (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references housing_requests(id) on delete cascade,
  doc_type      text not null,                    -- نفس تسميات قائمة التحقّق
  storage_path  text not null unique,
  original_name text not null,                    -- كما سمّاه صاحبه، للعرض فقط
  mime          text not null,
  bytes         int  not null check (bytes > 0),
  note          text,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists request_files_request_idx
  on request_files (request_id, doc_type, created_at);

comment on table request_files is
  'وثائق شخصية في مخزن خاصّ. لا رابط عمومي؛ الوصول برابط موقّع للفريق فقط.';

-- ---------- RLS: الفريق فقط ----------
alter table request_files enable row level security;

drop policy if exists request_files_staff_read on request_files;
create policy request_files_staff_read on request_files
  for select to authenticated using (is_staff());

-- ---------- قائمة التحقّق تعرف كم ملفّاً وراءها ----------
create or replace view request_document_status as
select
  d.request_id,
  d.doc_type,
  d.available,
  d.note,
  count(f.id)::int as files_count,
  max(f.created_at)  as last_file_at
from request_documents d
left join request_files f
  on f.request_id = d.request_id and f.doc_type = d.doc_type
group by d.request_id, d.doc_type, d.available, d.note;
