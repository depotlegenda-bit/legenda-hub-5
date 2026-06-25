
CREATE TABLE public.pic_daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operational_condition TEXT NOT NULL DEFAULT 'Lancar',
  crew_present INTEGER,
  cleanliness TEXT,
  equipment_condition TEXT,
  critical_stock TEXT,
  issues TEXT,
  actions_taken TEXT,
  notes_for_management TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, outlet_id, report_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pic_daily_reports TO authenticated;
GRANT ALL ON public.pic_daily_reports TO service_role;

ALTER TABLE public.pic_daily_reports ENABLE ROW LEVEL SECURITY;

-- Owner (PIC) full access on their own rows, restricted by outlet access
CREATE POLICY "Owner can view own pic daily reports"
ON public.pic_daily_reports FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "Owner can insert own pic daily reports"
ON public.pic_daily_reports FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "Owner can update own pic daily reports"
ON public.pic_daily_reports FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND public.pic_can_access_outlet(outlet_id))
WITH CHECK (user_id = auth.uid() AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "Owner can delete own pic daily reports"
ON public.pic_daily_reports FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND public.pic_can_access_outlet(outlet_id));

-- Management & Admin full access
CREATE POLICY "Management can view all pic daily reports"
ON public.pic_daily_reports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can update all pic daily reports"
ON public.pic_daily_reports FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can delete all pic daily reports"
ON public.pic_daily_reports FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

-- Updated_at trigger
CREATE TRIGGER trg_pic_daily_reports_updated_at
BEFORE UPDATE ON public.pic_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity log trigger
CREATE TRIGGER trg_pic_daily_reports_activity
AFTER INSERT OR UPDATE OR DELETE ON public.pic_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.log_table_activity('Laporan Harian PIC');
