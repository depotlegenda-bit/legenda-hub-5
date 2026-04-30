-- Tambahkan kolom shift_name ke attendance_thresholds untuk mendukung beberapa shift per cabang
ALTER TABLE public.attendance_thresholds
  ADD COLUMN IF NOT EXISTS shift_name text NOT NULL DEFAULT 'Default';

-- Hapus unique constraint lama yang hanya mengandalkan outlet_id (jika ada)
DO $$
DECLARE
  cons_name text;
BEGIN
  -- Drop constraint unik lama berbasis outlet_id saja (nama bisa bervariasi)
  FOR cons_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.attendance_thresholds'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.attendance_thresholds DROP CONSTRAINT %I', cons_name);
  END LOOP;

  -- Drop unique index lama yang hanya by outlet_id
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'attendance_thresholds'
      AND indexname IN ('attendance_thresholds_outlet_id_key', 'uniq_attendance_thresholds_outlet_global', 'uniq_attendance_thresholds_outlet')
  ) THEN
    DROP INDEX IF EXISTS public.attendance_thresholds_outlet_id_key;
    DROP INDEX IF EXISTS public.uniq_attendance_thresholds_outlet_global;
    DROP INDEX IF EXISTS public.uniq_attendance_thresholds_outlet;
  END IF;
END $$;

-- Buat unique index baru: kombinasi (outlet_id, shift_name) unik, dan untuk global (outlet_id IS NULL)
-- juga unik per shift_name.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_thresholds_outlet_shift
  ON public.attendance_thresholds (outlet_id, shift_name)
  WHERE outlet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_thresholds_global_shift
  ON public.attendance_thresholds (shift_name)
  WHERE outlet_id IS NULL;