-- ============================================================
-- 0045_client_proposals.sql · مقترحات الحلول المرسلة للحريف
-- ============================================================
-- «الحوصلة» في صفحة المطلب مكتوبة للفريق. الفريق يختار منها حلولاً
-- ويبعثها للحريف بلغته: بالواتساب، بنسخ النصّ، أو بنشر عناوينها في
-- صفحة المتابعة. كلّ إرسال يُحفظ هنا: ماذا اختير، بأيّ قناة، ومن أرسله.
--
-- titles: عناوين الحلول بلغة الحريف، بلا مبالغ — هي وحدها ما تعرضه صفحة
-- المتابعة (lib/tracking.ts لا يرجع أيّ مبلغ).
-- message: النصّ الكامل كما حُضّر، للفريق وحده.
-- ============================================================

create table if not exists client_proposals (
  id          bigserial primary key,
  request_id  uuid not null references housing_requests(id) on delete cascade,
  option_keys text[] not null,
  titles      text[] not null,
  message     text not null check (char_length(message) <= 8000),
  channel     text not null check (channel in ('tracking', 'whatsapp', 'copy')),
  lang        text not null default 'ar' check (lang in ('ar', 'fr')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

comment on table client_proposals is
  'مقترحات حلول أُرسلت للحريف أو نُشرت عناوينها في صفحة المتابعة';

create index if not exists client_proposals_request_idx
  on client_proposals (request_id, created_at desc);

-- الخادم وحده يقرأ ويكتب (مفتاح الخدمة) — لا سياسة عمومية
alter table client_proposals enable row level security;
