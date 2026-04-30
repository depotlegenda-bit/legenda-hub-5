ALTER TABLE public.inventory 
  ADD COLUMN IF NOT EXISTS waste numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outgoing_stock numeric NOT NULL DEFAULT 0;