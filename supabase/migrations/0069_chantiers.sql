-- ============================================================
-- 0069_chantiers.sql · الورشة والتقرير اليومي
-- ============================================================
-- القسم 07: بعد التعاقد يتابع الحريف مشروعه، وchef de projet يحضّر
-- تقريراً يومياً فيه المبرمج والمنجز وغير المنجز وأسبابه والقرارات
-- المطلوبة وبرنامج الغد، موثَّقاً بتاريخه واسم صاحبه.
--
-- والجملة التي تحكم البناء كلّه: «نسبة التقدّم تُحسب بمنهج معتمد على
-- الأشغال والكميات، لا بتقدير عشوائي».
--
-- فالتقرير لا يكتب نسبةً. يكتب **كمّيات منجَزة لكلّ سطر من العقد**،
-- والنسبة تُحسب منها موزونةً بقيمة السطر. «أنجزنا 60%» رأيٌ، و«صببنا
-- 18 م³ من 30» واقعة — والثانية وحدها تُراجَع وتُثبَّت.
--
-- وثلاث قواعد مكتوبة هنا لا في الشاشة:
--   · تقرير واحد لكلّ يوم لكلّ ورشة. تقريران ليوم واحد يجعلان
--     الكمّيات تُحتسب مرّتين.
--   · لا تُحتسب إلّا تقارير **معتمَدة**: ما لم يراجعه أحد لا يصير
--     رقماً يراه الحريف.
--   · الكمّية المنجزة تُقاس على سطر العقد نفسه، فتُكتشف الزيادة عليه
--     بدل أن تمرّ.
-- ============================================================

create sequence if not exists chantier_seq start 1;

create table if not exists chantiers (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default 'CH-' || lpad(nextval('chantier_seq')::text, 4, '0'),
  request_id    uuid not null references housing_requests (id) on delete restrict,
  -- العقد الذي يحدّد الكمّيات المتعاقَد عليها. بدونه لا تُحسب نسبة.
  devis_id      uuid references devis (id) on delete set null,
  chef_user_id  uuid references staff (user_id) on delete set null,
  status        text not null default 'preparing'
                check (status in ('preparing', 'running', 'paused', 'delivered', 'stopped')),
  -- التوقّف يُعلَّل: ورشة متوقّفة بلا سبب تبدو إهمالاً
  status_note   text,
  started_at    date,
  expected_end  date,
  delivered_at  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references staff (user_id) on delete set null
);

create index if not exists chantiers_request_idx on chantiers (request_id);
create index if not exists chantiers_status_idx on chantiers (status);

alter table chantiers enable row level security;
revoke all on chantiers from anon, authenticated;

-- ---------- التقرير اليومي ----------
create table if not exists site_reports (
  id              uuid primary key default gen_random_uuid(),
  chantier_id     uuid not null references chantiers (id) on delete cascade,
  report_date     date not null,
  -- الطقس يوقف الصبّ والدهن: سببٌ يُسجَّل لا يُعتذَر به بعد شهر
  weather         text,
  planned         text,
  done            text,
  blocked         text,
  blocked_reason  text,
  -- «المشاكل والقرارات المطلوبة» — تذهب إلى صندوق الموافقات
  decision_needed text,
  next_plan       text,
  status          text not null default 'draft'
                  check (status in ('draft', 'submitted', 'approved', 'rejected')),
  review_note     text,
  author          uuid references staff (user_id) on delete set null,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     uuid references staff (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- تقرير واحد لكلّ يوم: تقريران يحتسبان الكمّيات مرّتين
  unique (chantier_id, report_date)
);

create index if not exists site_reports_chantier_idx on site_reports (chantier_id, report_date desc);
create index if not exists site_reports_status_idx on site_reports (status);

alter table site_reports enable row level security;
revoke all on site_reports from anon, authenticated;

-- ---------- الكمّيات المنجزة ----------
-- هنا تُحسب النسبة. السطر يشير إلى سطر العقد نفسه، فتبقى الكمّية
-- المنجزة مقيسةً على المتعاقَد عليه لا على تقدير.
create table if not exists site_report_lines (
  report_id     uuid not null references site_reports (id) on delete cascade,
  -- bigint لا uuid: devis_lines.id تسلسلي
  devis_line_id bigint not null references devis_lines (id) on delete cascade,
  qty_done      numeric(12, 3) not null check (qty_done > 0),
  note          text,
  primary key (report_id, devis_line_id)
);

alter table site_report_lines enable row level security;
revoke all on site_report_lines from anon, authenticated;

-- ---------- الصور ----------
create table if not exists site_report_photos (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references site_reports (id) on delete cascade,
  storage_path text not null,
  caption      text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid references staff (user_id) on delete set null
);

create index if not exists site_report_photos_report_idx
  on site_report_photos (report_id, sort_order);

alter table site_report_photos enable row level security;
revoke all on site_report_photos from anon, authenticated;

-- صور الورشة ملكنا ومن تصويرنا، فلا تحتاج مصدراً وإذناً كصور
-- المورّدين. لكنّها تُنشر للحريف صاحبها وحده، والدلو خاصّ.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop trigger if exists chantiers_touch on chantiers;
create trigger chantiers_touch before update on chantiers
  for each row execute function touch_updated_at();

drop trigger if exists site_reports_touch on site_reports;
create trigger site_reports_touch before update on site_reports
  for each row execute function touch_updated_at();

comment on table site_report_lines is
  'الكمّيات المنجزة لكلّ سطر عقد. منها تُحسب نسبة التقدّم — ولا تُكتب نسبة بيد أحد.';
comment on column site_reports.status is
  'لا يُحتسب في التقدّم إلّا approved: ما لم يُراجَع لا يصير رقماً يراه الحريف.';
