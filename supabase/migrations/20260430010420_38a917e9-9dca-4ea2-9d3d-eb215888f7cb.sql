
-- Tabel pengaturan ambang waktu absensi (singleton row, dikelola admin)
CREATE TABLE IF NOT EXISTS public.attendance_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Jam standar shift (HH:MM, waktu lokal Asia/Jakarta WIB)
  check_in_start time NOT NULL DEFAULT '07:00',     -- jam ideal mulai check-in
  check_in_late_after time NOT NULL DEFAULT '08:00', -- setelah jam ini = terlambat
  check_out_earliest time NOT NULL DEFAULT '17:00',  -- sebelum jam ini = pulang duluan
  check_out_latest time NOT NULL DEFAULT '22:00',    -- batas wajar check-out
  early_checkin_minutes integer NOT NULL DEFAULT 30, -- toleransi check-in lebih awal (menit)
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendance_thresholds"
ON public.attendance_thresholds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage attendance_thresholds"
ON public.attendance_thresholds FOR ALL TO public
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Management manage attendance_thresholds"
ON public.attendance_thresholds FOR ALL TO public
USING (has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE TRIGGER trg_attendance_thresholds_updated_at
BEFORE UPDATE ON public.attendance_thresholds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default singleton row
INSERT INTO public.attendance_thresholds (check_in_start, check_in_late_after, check_out_earliest, check_out_latest, early_checkin_minutes)
VALUES ('07:00', '08:00', '17:00', '22:00', 30);

-- Update handle_new_user untuk menyimpan job_title & employment_status dari metadata signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_join_date date := NULL;
BEGIN
  IF (meta->>'join_year') IS NOT NULL AND (meta->>'join_month') IS NOT NULL THEN
    BEGIN
      v_join_date := make_date((meta->>'join_year')::int, (meta->>'join_month')::int, 1);
    EXCEPTION WHEN OTHERS THEN
      v_join_date := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, nickname, address, phone, nik,
    outlet_id, join_date, job_title, employment_status
  )
  VALUES (
    NEW.id,
    COALESCE(meta->>'full_name', ''),
    COALESCE(meta->>'nickname', ''),
    COALESCE(meta->>'address', ''),
    COALESCE(meta->>'phone', ''),
    COALESCE(meta->>'nik', ''),
    NULLIF(meta->>'outlet_id', '')::uuid,
    v_join_date,
    COALESCE(NULLIF(meta->>'job_title', ''), 'Crew'),
    COALESCE(NULLIF(meta->>'employment_status', ''), 'Contract')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    nickname  = COALESCE(NULLIF(EXCLUDED.nickname,  ''), public.profiles.nickname),
    address   = COALESCE(NULLIF(EXCLUDED.address,   ''), public.profiles.address),
    phone     = COALESCE(NULLIF(EXCLUDED.phone,     ''), public.profiles.phone),
    nik       = COALESCE(NULLIF(EXCLUDED.nik,       ''), public.profiles.nik),
    outlet_id = COALESCE(EXCLUDED.outlet_id, public.profiles.outlet_id),
    join_date = COALESCE(EXCLUDED.join_date, public.profiles.join_date),
    job_title = COALESCE(NULLIF(EXCLUDED.job_title, ''), public.profiles.job_title),
    employment_status = COALESCE(NULLIF(EXCLUDED.employment_status, ''), public.profiles.employment_status);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
