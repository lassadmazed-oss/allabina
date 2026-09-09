-- ============================================================
-- 0026_property_media.sql · صور العقار وفيديوهاته
-- ============================================================
-- صاحب العقار كان يقرا: «الصور والفيديو: الفريق باش يطلبهم في المكالمة».
-- يعني مكالمة زايدة على الفريق، وانتظار على المالك، وعرض بلا صورة في
-- شاشة المراجعة — والصورة هي أوّل ما يقرّر إن كان العرض يستاهل وقتاً.
--
-- المخزن خاصّ لا عمومي: العقار نفسه ما يتنشرش في الموقع، فبالأحرى صوره.
-- الفريق يفتحها برابط موقّت في الـBack-office.
-- ============================================================

-- ---------- المخزن ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-media', 'property-media', false,
  52428800,                                       -- 50 MiB: فيديو قصير من الهاتف
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public             = false,                 -- لا يُفتح سهواً
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- توسيع جدول الوسائط ----------
-- الجدول كان يحمل url خارجياً فقط. نضيف ما يلزم للملفّ المرفوع، ونبقي
-- url للروابط الخارجية (فيديو على منصّة مثلاً) حتى لا نكسر ما هو قائم.
alter table property_media add column if not exists storage_path  text;
alter table property_media add column if not exists original_name text;
alter table property_media add column if not exists mime          text;
alter table property_media add column if not exists bytes         int;
alter table property_media add column if not exists sort_order    int not null default 0;

create unique index if not exists property_media_path_key
  on property_media (storage_path) where storage_path is not null;

create index if not exists property_media_property_idx
  on property_media (property_id, sort_order);

-- سطر بلا ملفّ ولا رابط لا معنى له
alter table property_media drop constraint if exists property_media_has_source;
alter table property_media add constraint property_media_has_source
  check (storage_path is not null or url is not null);

comment on column property_media.storage_path is
  'مسار الملفّ في مخزن property-media — يُفتح برابط موقّع، لا برابط عمومي';

-- ---------- RLS ----------
alter table property_media enable row level security;

drop policy if exists property_media_staff_read on property_media;
create policy property_media_staff_read on property_media for select to authenticated
  using (is_staff());
