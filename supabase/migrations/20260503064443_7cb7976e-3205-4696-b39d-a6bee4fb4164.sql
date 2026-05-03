-- Add new columns
ALTER TABLE public.content_plans
  ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'product_review',
  ADD COLUMN IF NOT EXISTS pillar_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS posted_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_leads integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_saves integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_link_clicks integer DEFAULT 0;

-- Migrate legacy status values
UPDATE public.content_plans SET status = 'briefing' WHERE status = 'draft';
UPDATE public.content_plans SET status = 'production' WHERE status IN ('in_progress','review');

-- Replace status check constraint
ALTER TABLE public.content_plans DROP CONSTRAINT IF EXISTS content_plans_status_check;
ALTER TABLE public.content_plans ADD CONSTRAINT content_plans_status_check
  CHECK (status = ANY (ARRAY['idea','briefing','production','posted','archived']));

-- Add platform check constraint
ALTER TABLE public.content_plans DROP CONSTRAINT IF EXISTS content_plans_platform_check;
ALTER TABLE public.content_plans ADD CONSTRAINT content_plans_platform_check
  CHECK (platform = ANY (ARRAY['instagram','tiktok','youtube','linkedin','facebook','x','other']));

-- Add content_type check
ALTER TABLE public.content_plans DROP CONSTRAINT IF EXISTS content_plans_content_type_check;
ALTER TABLE public.content_plans ADD CONSTRAINT content_plans_content_type_check
  CHECK (content_type = ANY (ARRAY['product_review','behind_the_scenes','promo','educational','user_story']));