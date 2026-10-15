CREATE TABLE public.hpp_outlet_workspaces (
 outlet_id uuid PRIMARY KEY REFERENCES public.outlets(id) ON DELETE CASCADE,
 materials jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(materials)='array'),
 products jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(products)='array'),
 fixed_cost numeric NOT NULL DEFAULT 0 CHECK (fixed_cost >= 0),
 version integer NOT NULL DEFAULT 1,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.hpp_outlet_workspaces TO authenticated;
GRANT ALL ON public.hpp_outlet_workspaces TO service_role;
ALTER TABLE public.hpp_outlet_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY hpp_outlet_read ON public.hpp_outlet_workspaces FOR SELECT TO authenticated USING (true);
CREATE POLICY hpp_outlet_update ON public.hpp_outlet_workspaces FOR UPDATE TO authenticated USING (public.hpp_has_permission('create') OR public.hpp_has_permission('edit') OR public.hpp_has_permission('delete')) WITH CHECK (public.hpp_has_permission('create') OR public.hpp_has_permission('edit') OR public.hpp_has_permission('delete'));
CREATE TRIGGER hpp_outlet_validate BEFORE UPDATE ON public.hpp_outlet_workspaces FOR EACH ROW EXECUTE FUNCTION public.hpp_validate_update();
INSERT INTO public.hpp_outlet_workspaces (outlet_id) SELECT id FROM public.outlets WHERE lower(trim(name)) <> 'manajemen';
CREATE OR REPLACE FUNCTION public.hpp_provision_outlet_workspace() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF lower(trim(NEW.name)) <> 'manajemen' THEN
  INSERT INTO public.hpp_outlet_workspaces(outlet_id) VALUES (NEW.id) ON CONFLICT (outlet_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hpp_provision_outlet_workspace() FROM PUBLIC;
CREATE TRIGGER hpp_provision_outlet AFTER INSERT OR UPDATE OF name ON public.outlets FOR EACH ROW EXECUTE FUNCTION public.hpp_provision_outlet_workspace();
COMMENT ON TABLE public.hpp_workspaces IS 'DEPRECATED: legacy shared workspace retained; HPP now uses public.hpp_outlet_workspaces for separate outlet rooms.';