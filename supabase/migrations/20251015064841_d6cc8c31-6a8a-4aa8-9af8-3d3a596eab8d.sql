-- Add onboarding_completed flag to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_onboarding 
ON public.user_preferences(user_id, onboarding_completed);

COMMENT ON COLUMN public.user_preferences.onboarding_completed IS 'Tracks whether user has completed the initial onboarding wizard';