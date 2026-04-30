-- Tambahkan policy admin full access pada outlet_materials
CREATE POLICY "Admin full access outlet materials"
ON public.outlet_materials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));