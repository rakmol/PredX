-- ============================================================
-- PredX — Full Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout
-- ============================================================

-- Enable UUID helper
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- One row per auth user. Auto-created on signup via trigger.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  TEXT,
  username               TEXT UNIQUE,
  avatar_url             TEXT,
  subscription_tier      TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_expires_at TIMESTAMPTZ,
  devices                TEXT[] DEFAULT '{}',        -- array of device fingerprints (max 2)
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 2. PREDICTIONS
-- Cached AI prediction results per user/coin/timeframe.
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  coin_id             TEXT NOT NULL,
  coin_symbol         TEXT NOT NULL,
  coin_name           TEXT,
  timeframe           TEXT NOT NULL CHECK (timeframe IN ('24h', '7d', '30d', '90d')),
  current_price       NUMERIC NOT NULL,
  overall_signal      TEXT CHECK (overall_signal IN ('strong_buy','buy','hold','sell','strong_sell')),
  confidence_score    INTEGER CHECK (confidence_score BETWEEN 0 AND 100),

  -- Scenario targets (JSON objects)
  scenario_bullish    JSONB,   -- { price_target, percentage_change, confidence, key_factors[] }
  scenario_neutral    JSONB,
  scenario_bearish    JSONB,

  -- Supporting data snapshots
  technicals          JSONB,
  sentiment           JSONB,
  ai_analysis         TEXT,
  key_risks           TEXT[],
  key_opportunities   TEXT[],

  is_blurred          BOOLEAN DEFAULT TRUE,  -- TRUE for free-tier users
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_user      ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_coin_tf   ON predictions(coin_id, timeframe);
CREATE INDEX IF NOT EXISTS idx_predictions_expires   ON predictions(expires_at);


-- ============================================================
-- 3. PORTFOLIOS
-- One portfolio summary row per user (upserted on refresh).
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolios (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_value_usd  NUMERIC DEFAULT 0,
  total_cost_basis NUMERIC DEFAULT 0,
  total_pnl_usd    NUMERIC DEFAULT 0,
  total_pnl_pct    NUMERIC DEFAULT 0,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);


-- ============================================================
-- 4. PORTFOLIO POSITIONS
-- Individual coin holdings per portfolio.
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_positions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  portfolio_id    UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  coin_id         TEXT NOT NULL,
  coin_symbol     TEXT NOT NULL,
  coin_name       TEXT,
  image_url       TEXT,
  amount          NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price   NUMERIC NOT NULL DEFAULT 0,
  current_price   NUMERIC DEFAULT 0,
  current_value   NUMERIC DEFAULT 0,
  cost_basis      NUMERIC DEFAULT 0,
  pnl_usd         NUMERIC DEFAULT 0,
  pnl_pct         NUMERIC DEFAULT 0,
  allocation_pct  NUMERIC DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, coin_id)
);

CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON portfolio_positions(portfolio_id);


-- ============================================================
-- 5. EXCHANGE CONNECTIONS
-- Read-only API keys for Binance / Bybit / KuCoin.
-- Keys are encrypted at rest by the backend before storing.
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_connections (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exchange             TEXT NOT NULL CHECK (exchange IN ('binance', 'bybit', 'kucoin')),
  label                TEXT,                          -- user-friendly nickname
  api_key_encrypted    TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  is_active            BOOLEAN DEFAULT TRUE,
  last_synced_at       TIMESTAMPTZ,
  connected_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exchange)
);

CREATE INDEX IF NOT EXISTS idx_connections_user ON exchange_connections(user_id);


-- ============================================================
-- 6. PRICE ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  coin_id      TEXT NOT NULL,
  coin_symbol  TEXT NOT NULL,
  condition    TEXT NOT NULL CHECK (condition IN ('above', 'below', 'change_pct')),
  threshold    NUMERIC NOT NULL,
  threshold_currency TEXT NOT NULL DEFAULT 'USD' CHECK (threshold_currency IN ('USD', 'GHS')),
  display_threshold NUMERIC,
  notification_methods TEXT[] DEFAULT ARRAY['in_app'],
  is_active    BOOLEAN DEFAULT TRUE,
  triggered_price NUMERIC,
  triggered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user   ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS display_threshold NUMERIC;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_methods TEXT[] DEFAULT ARRAY['in_app'];
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_price NUMERIC;


-- ============================================================
-- 7. WATCHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  coin_id     TEXT NOT NULL,
  coin_symbol TEXT NOT NULL,
  coin_name   TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, coin_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_positions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist            ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles: select own" ON profiles;
CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: update own" ON profiles;
CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- predictions
DROP POLICY IF EXISTS "predictions: select own" ON predictions;
CREATE POLICY "predictions: select own"
  ON predictions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "predictions: insert own" ON predictions;
CREATE POLICY "predictions: insert own"
  ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "predictions: delete own" ON predictions;
CREATE POLICY "predictions: delete own"
  ON predictions FOR DELETE USING (auth.uid() = user_id);

-- portfolios
DROP POLICY IF EXISTS "portfolios: all own" ON portfolios;
CREATE POLICY "portfolios: all own"
  ON portfolios FOR ALL USING (auth.uid() = user_id);

-- portfolio_positions (access via portfolio ownership)
DROP POLICY IF EXISTS "positions: all own" ON portfolio_positions;
CREATE POLICY "positions: all own"
  ON portfolio_positions FOR ALL
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- exchange_connections
DROP POLICY IF EXISTS "connections: all own" ON exchange_connections;
CREATE POLICY "connections: all own"
  ON exchange_connections FOR ALL USING (auth.uid() = user_id);

-- alerts
DROP POLICY IF EXISTS "alerts: all own" ON alerts;
CREATE POLICY "alerts: all own"
  ON alerts FOR ALL USING (auth.uid() = user_id);

-- watchlist
DROP POLICY IF EXISTS "watchlist: all own" ON watchlist;
CREATE POLICY "watchlist: all own"
  ON watchlist FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- NOTE: The backend uses SUPABASE_SERVICE_KEY which bypasses
-- RLS automatically — no extra policies needed for server calls.
-- ============================================================
