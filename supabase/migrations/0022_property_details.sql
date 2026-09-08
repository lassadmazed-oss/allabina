-- ============================================================
-- 0022_property_details.sql · تفاصيل العقار
-- ============================================================
-- «عدد الغرف» وحده لا يصف مسكناً. المستشار كان يتّصل بصاحب العقار ليسأل:
-- كم غرفة نوم؟ كم حمّام؟ أيّ طابق؟ فيه جراج؟ الحالة؟ سنة البناء؟
-- كلّها أسئلة الاستمارة كان يلزمها تسألها — وهي ما يحدّد إن كان العقار
-- يطابق مطلباً أو لا.
--
-- الحقول اختيارية كلّها: عرضٌ ناقص التفاصيل أحسن من عرضٍ لم يُرسل.
-- ============================================================

do $$ begin
  create type property_condition as enum ('new', 'good', 'to_refresh', 'to_renovate');
exception when duplicate_object then null; end $$;

comment on type property_condition is
  'new: جديد لم يُسكن · good: جيّد · to_refresh: يحتاج تحسيناً بسيطاً · to_renovate: يحتاج ترميماً';

-- ---------- المسكن (دار · شقة · عمارة) ----------
alter table properties add column if not exists bedrooms       smallint check (bedrooms between 0 and 30);
alter table properties add column if not exists living_rooms   smallint check (living_rooms between 0 and 10);
alter table properties add column if not exists bathrooms      smallint check (bathrooms between 0 and 20);
alter table properties add column if not exists floors         smallint check (floors between 1 and 30);   -- عدد الطوابق (دار/عمارة)
alter table properties add column if not exists floor_number   smallint check (floor_number between 0 and 60); -- الطابق (شقة)
alter table properties add column if not exists year_built     smallint check (year_built between 1800 and 2100);
alter table properties add column if not exists condition      property_condition;
alter table properties add column if not exists garage         boolean;
alter table properties add column if not exists garden         boolean;
alter table properties add column if not exists terrace        boolean;
alter table properties add column if not exists elevator       boolean;
alter table properties add column if not exists furnished      boolean;

-- ---------- الربط بالشبكات (الكلّ) ----------
alter table properties add column if not exists water_connected boolean;
alter table properties add column if not exists power_connected boolean;

-- ---------- الأرض ----------
alter table properties add column if not exists road_access    boolean;                                    -- طريق نفاذ
alter table properties add column if not exists frontage_m     numeric(6,2) check (frontage_m > 0);        -- طول الواجهة
alter table properties add column if not exists buildable      boolean;                                    -- قابلة للبناء (حسب علم المالك)

comment on column properties.buildable is
  'حسب تصريح المالك لا حسب مثال التهيئة — يُتثبَّت منه عند المراجعة';
