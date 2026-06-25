ALTER TABLE public.pic_daily_reports
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}'::jsonb;