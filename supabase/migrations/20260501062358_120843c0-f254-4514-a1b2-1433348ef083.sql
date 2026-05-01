-- Add shift_name to attendance_logs so each clock-in/out is tied to a specific shift
ALTER TABLE public.attendance_logs
ADD COLUMN IF NOT EXISTS shift_name text NOT NULL DEFAULT 'Default';

CREATE INDEX IF NOT EXISTS idx_attendance_logs_shift ON public.attendance_logs(shift_name);
