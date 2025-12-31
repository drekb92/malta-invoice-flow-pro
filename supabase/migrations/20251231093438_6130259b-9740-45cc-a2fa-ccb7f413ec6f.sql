-- Add reminder_mode column to reminder_settings table
ALTER TABLE public.reminder_settings 
ADD COLUMN reminder_mode TEXT DEFAULT 'manual' 
CHECK (reminder_mode IN ('automatic', 'manual'));