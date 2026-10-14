CREATE TABLE public.hpp_workspaces (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 materials jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(materials) = 'array'),
 products jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(products) = 'array'),
 fixed_cost numeric NOT NULL DEFAULT 8000000 CHECK (fixed_cost >= 0),
 version integer NOT NULL DEFAULT 1,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.hpp_workspaces TO authenticated;
GRANT ALL ON public.hpp_workspaces TO service_role;
ALTER TABLE public.hpp_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY hpp_shared_read ON public.hpp_workspaces FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.hpp_has_permission(action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND (r.role='admin' OR COALESCE((SELECT p.enabled AND CASE action WHEN 'create' THEN p.can_create WHEN 'edit' THEN p.can_edit WHEN 'delete' THEN p.can_delete ELSE false END FROM public.role_menu_permissions p WHERE p.role=r.role AND p.menu_key='hpp.calculator' LIMIT 1), r.role IN ('management','pic') AND (action <> 'delete' OR r.role='management'))));
$$;
REVOKE ALL ON FUNCTION public.hpp_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hpp_has_permission(text) TO authenticated, service_role;
CREATE POLICY hpp_shared_update ON public.hpp_workspaces FOR UPDATE TO authenticated USING (public.hpp_has_permission('create') OR public.hpp_has_permission('edit') OR public.hpp_has_permission('delete')) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.hpp_validate_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE old_items jsonb; new_items jsonb; kind text;
BEGIN
 IF auth.uid() IS NOT NULL THEN
  FOREACH kind IN ARRAY ARRAY['materials','products'] LOOP
   old_items := to_jsonb(OLD)->kind; new_items := to_jsonb(NEW)->kind;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(new_items) n WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(old_items) o WHERE o->>'id'=n->>'id')) AND NOT public.hpp_has_permission('create') THEN RAISE EXCEPTION 'Tidak memiliki izin menambah data HPP'; END IF;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(old_items) o WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(new_items) n WHERE n->>'id'=o->>'id')) AND NOT public.hpp_has_permission('delete') THEN RAISE EXCEPTION 'Tidak memiliki izin menghapus data HPP'; END IF;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(new_items) n JOIN jsonb_array_elements(old_items) o ON o->>'id'=n->>'id' WHERE o<>n) AND NOT public.hpp_has_permission('edit') THEN RAISE EXCEPTION 'Tidak memiliki izin mengedit data HPP'; END IF;
  END LOOP;
  IF NEW.fixed_cost<>OLD.fixed_cost AND NOT public.hpp_has_permission('edit') THEN RAISE EXCEPTION 'Tidak memiliki izin mengedit biaya HPP'; END IF;
 END IF;
 NEW.version:=OLD.version+1; NEW.updated_at:=now(); NEW.updated_by:=auth.uid(); RETURN NEW;
END;
$$;
CREATE TRIGGER hpp_validate_update BEFORE UPDATE ON public.hpp_workspaces FOR EACH ROW EXECUTE FUNCTION public.hpp_validate_update();