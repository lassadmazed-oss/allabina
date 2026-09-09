-- 0032_support_photos.sql · صور حالات المساندة
--
-- الحالة اللي تحتاج مساندة تُفهم بالصورة قبل الكلام: سقف ناقص، هيكل متوقّف،
-- جدار يرشح. نفس مخزن case-photos، تحت مسار support/<support_case_id>/…
-- كلّ صورة منشورة بموافقة صاحب الحالة، ومجهّلة (بلا وجوه ولا أسماء).

create table if not exists support_photos (
  id              uuid primary key default gen_random_uuid(),
  support_case_id uuid not null references support_cases(id) on delete cascade,
  storage_path    text not null unique,
  caption_ar      text,
  caption_fr      text,
  sort_order      int  not null default 0,
  mime            text,
  bytes           int,
  created_at      timestamptz not null default now()
);

create index if not exists support_photos_case_idx
  on support_photos (support_case_id, sort_order);

comment on table support_photos is
  'صور حالات المساندة — تُقرأ من الخادم فقط؛ الملفّات في مخزن case-photos تحت support/<id>/';

-- ---------- RLS ----------
alter table support_photos enable row level security;

-- العموم يقرأ صور الحالات المنشورة فقط
drop policy if exists support_photos_public_read on support_photos;
create policy support_photos_public_read on support_photos
  for select to anon, authenticated
  using (exists (
    select 1 from support_cases s
    where s.id = support_photos.support_case_id and s.published
  ));

drop policy if exists support_photos_staff_read on support_photos;
create policy support_photos_staff_read on support_photos
  for select to authenticated using (is_staff());
