CREATE POLICY "Stockman full access outlet materials"
ON public.outlet_materials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'stockman'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'stockman'::public.app_role));