-- Add email_updates preference to profiles
-- Run this in Supabase SQL editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_updates boolean DEFAULT true;
