
ALTER TABLE public.attendance_thresholds
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE;

-- Unique per outlet (NULL outlet_id = global default; only one global allowed)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_thresholds_outlet_unique
  ON public.attendance_thresholds (outlet_id)
  WHERE outlet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_thresholds_global_unique
  ON public.attendance_thresholds ((1))
  WHERE outlet_id IS NULL;
