-- ============================================================
-- Migration: Affiliate / Referral System
-- Run in Supabase SQL Editor → Project → SQL Editor
-- ============================================================

-- 1. Add ref_code to profiles (unique 8-char code per user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE;

-- 2. Back-fill ref_code for existing users who don't have one
UPDATE profiles
SET ref_code = LOWER(SUBSTRING(MD5(id::text), 1, 8))
WHERE ref_code IS NULL;

-- 3. Update handle_new_user trigger to auto-generate ref_code on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, username, ref_code)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1),
    LOWER(SUBSTRING(MD5(NEW.id::text), 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)  -- each user can only be referred once
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- 5. RLS on referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals: select own" ON referrals;
CREATE POLICY "referrals: select own"
  ON referrals FOR SELECT USING (auth.uid() = referrer_id);
