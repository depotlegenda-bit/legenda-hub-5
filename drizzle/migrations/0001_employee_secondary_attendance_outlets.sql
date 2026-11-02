CREATE TABLE public.employee_attendance_outlets (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, outlet_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_attendance_outlets TO authenticated;
GRANT ALL ON public.employee_attendance_outlets TO service_role;
ALTER TABLE public.employee_attendance_outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read attendance assignments" ON public.employee_attendance_outlets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin() OR public.has_role(auth.uid(), 'management') OR (public.has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id)));
CREATE POLICY "Admin manages attendance assignments" ON public.employee_attendance_outlets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE FUNCTION public.set_employee_attendance_outlets(_user_id uuid, _outlet_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Hanya admin dapat mengatur cabang double job'; END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil karyawan tidak ditemukan'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_outlet_ids) AS x(id) LEFT JOIN public.outlets o ON o.id=x.id WHERE o.id IS NULL OR o.name='Manajemen') THEN RAISE EXCEPTION 'Cabang double job tidak valid'; END IF;
  DELETE FROM public.employee_attendance_outlets WHERE user_id = _user_id;
  INSERT INTO public.employee_attendance_outlets(user_id,outlet_id,assigned_by) SELECT _user_id, id, auth.uid() FROM (SELECT DISTINCT unnest(_outlet_ids) AS id) x;
END;
$$;
REVOKE ALL ON FUNCTION public.set_employee_attendance_outlets(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_employee_attendance_outlets(uuid,uuid[]) TO authenticated;
CREATE FUNCTION public.validate_attendance_outlet_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.has_role(auth.uid(), 'management') THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.outlet_id IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.outlet_id=NEW.outlet_id)
    OR EXISTS (SELECT 1 FROM public.employee_attendance_outlets a WHERE a.user_id=auth.uid() AND a.outlet_id=NEW.outlet_id)
  ) THEN RAISE EXCEPTION 'Cabang absen belum ditugaskan oleh admin'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_attendance_outlet_assignment BEFORE INSERT ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_outlet_assignment();