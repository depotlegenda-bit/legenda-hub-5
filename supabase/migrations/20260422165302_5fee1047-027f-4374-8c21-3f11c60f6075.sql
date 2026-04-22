CREATE TABLE public.outlet_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  minimum_threshold NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outlet_materials ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX outlet_materials_outlet_name_unique_idx
ON public.outlet_materials (outlet_id, lower(name));

CREATE INDEX outlet_materials_outlet_id_idx
ON public.outlet_materials (outlet_id);

CREATE TRIGGER update_outlet_materials_updated_at
BEFORE UPDATE ON public.outlet_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view outlet materials"
ON public.outlet_materials
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Management full access outlet materials"
ON public.outlet_materials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'management'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'management'::public.app_role));

CREATE POLICY "PIC insert outlet materials for own outlet"
ON public.outlet_materials
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'pic'::public.app_role)
  AND public.pic_can_access_outlet(outlet_id)
);

CREATE POLICY "PIC update outlet materials for own outlet"
ON public.outlet_materials
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'pic'::public.app_role)
  AND public.pic_can_access_outlet(outlet_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'pic'::public.app_role)
  AND public.pic_can_access_outlet(outlet_id)
);

CREATE POLICY "PIC delete outlet materials for own outlet"
ON public.outlet_materials
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'pic'::public.app_role)
  AND public.pic_can_access_outlet(outlet_id)
);