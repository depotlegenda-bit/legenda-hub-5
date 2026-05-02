CREATE TABLE public.shopping_buffer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NULL UNIQUE,
  buffer_percent NUMERIC NOT NULL DEFAULT 30,
  updated_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shopping_buffer_settings_global_idx
  ON public.shopping_buffer_settings ((outlet_id IS NULL))
  WHERE outlet_id IS NULL;

ALTER TABLE public.shopping_buffer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view shopping buffer"
ON public.shopping_buffer_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage shopping buffer"
ON public.shopping_buffer_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Management manage shopping buffer"
ON public.shopping_buffer_settings
FOR ALL
USING (has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE TRIGGER update_shopping_buffer_settings_updated_at
BEFORE UPDATE ON public.shopping_buffer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();