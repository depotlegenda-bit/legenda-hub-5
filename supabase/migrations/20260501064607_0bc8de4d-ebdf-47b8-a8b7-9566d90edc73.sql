ALTER TABLE public.attendance_logs
ADD COLUMN IF NOT EXISTS status_override text,
ADD COLUMN IF NOT EXISTS status_override_by uuid,
ADD COLUMN IF NOT EXISTS status_override_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS status_override_note text;