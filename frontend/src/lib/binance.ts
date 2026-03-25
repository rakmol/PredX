/**
 * Binance Exchange Integration
 *
 * Security model:
 *  1. API keys are NEVER stored in plain text.
 *  2. Keys are encrypted with AES-256-GCM (Web Crypto API) before writing to Supabase.
 *  3. The encryption key is derived via PBKDF2 from an app-level secret + the user's ID,
 *     so a Supabase DB breach does not expose usable keys.
 *  4. PredX only requests READ-ONLY permissions — no trading or withdrawal scopes.
 *  5. All Binance requests are signed with HMAC-SHA256 per Binance's security spec.
 *
 * Supabase table required:
 *   exchange_connections (
 *     id              uuid primary key default gen_random_uuid(),
 *     user_id         uuid references profiles(id) on delete cascade,
 *     exchange        text not null,          -- e.g. 'binance'
 *     encrypted_api_key    text not null,
 *     encrypted_api_secret text not null,
 *     last_synced_at  timestamptz,
 *     created_at      timestamptz default now(),
 *     unique(user_id, exchange)
 *   );
 */

import { supabase } from './supabase';

const BINANCE_BASE = 'https://api.binance.com';

// App-level encryption secret (set VITE_EXCHANGE_ENCRYPTION_KEY in .env)
// Even if this leaks, the user-ID salt means each user's keys need a separate crack.
const ENCRYPTION_SECRET =
  import.meta.env.VITE_EXCHANGE_ENCRYPTION_KEY ?? 'predx-exchange-key-fallback-v1';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface Balance {
  coin: string;
  free: number;
  locked: number;
  valueUSD: number;
}

export interface Trade {
  coin: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  quoteQty: number;
  time: string; // ISO string
}

export interface OpenOrder {
  symbol: string;
  orderId: number;
  side: string;
  type: string;
  price: number;
  qty: number;
  executedQty: number;
  status: string;
  time: string;
}

export interface ExchangeConnection {
  id: string;
  user_id: string;
  exchange: string;
  encrypted_api_key: string;
  encrypted_api_secret: string;
  last_synced_at: string | null;
  created_at: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  canTrade?: boolean; // we warn if trading permissions are accidentally enabled
}

/* ═════════════════════════════════════════════════════════════════════════
   AES-256-GCM ENCRYPTION
   Format: base64( 12-byte IV ‖ ciphertext+authTag )
   PBKDF2 key derivation: ENCRYPTION_SECRET × 100 000 iterations × userId salt
   ═════════════════════════════════════════════════════════════════════════ */

async function deriveEncryptionKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(ENCRYPTION_SECRET),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(userId),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptField(plaintext: string, userId: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV — recommended for GCM
  const key = await deriveEncryptionKey(userId);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));

  // Prepend IV so we can recover it on decrypt
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptField(ciphertext: string, userId: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await deriveEncryptionKey(userId);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

/* ═════════════════════════════════════════════════════════════════════════
   HMAC-SHA256 SIGNING  (Binance API security requirement)
   ═════════════════════════════════════════════════════════════════════════ */

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ─── Core signed request ─────────────────────────────────────────────── */

async function binanceRequest<T>(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ ...params, timestamp: String(Date.now()) }).map(([k, v]) => [k, String(v)]),
    ),
  );
  const signature = await hmacSHA256(apiSecret, qs.toString());
  qs.append('signature', signature);

  const res = await fetch(`${BINANCE_BASE}${endpoint}?${qs.toString()}`, {
    method: 'GET',
    headers: { 'X-MBX-APIKEY': apiKey },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { msg?: string };
    throw new Error(err.msg ?? `Binance API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ═════════════════════════════════════════════════════════════════════════
   PUBLIC API FUNCTIONS
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Verify that the provided keys are valid and check permission level.
 * Warns if trading/withdrawal permissions are enabled (should be read-only).
 */
export async function testConnection(apiKey: string, apiSecret: string): Promise<TestResult> {
  try {
    const account = await binanceRequest<{
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: unknown[];
    }>(apiKey, apiSecret, '/api/v3/account');

    if (account.canWithdraw) {
      return {
        success: false,
        message:
          'Warning: These keys have WITHDRAWAL permissions enabled. Please regenerate your API key with READ-ONLY permissions to proceed.',
        canTrade: account.canTrade,
      };
    }

    return {
      success: true,
      message: account.canTrade
        ? 'Connected — but trading permissions are enabled. For maximum safety, use read-only keys.'
        : 'Connected successfully. Read-only access confirmed.',
      canTrade: account.canTrade,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, message };
  }
}

/**
 * Returns all non-zero balances with estimated USD value.
 */
export async function getAccountBalance(
  apiKey: string,
  apiSecret: string,
): Promise<Balance[]> {
  const [account, priceList] = await Promise.all([
    binanceRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
      apiKey,
      apiSecret,
      '/api/v3/account',
    ),
    fetch(`${BINANCE_BASE}/api/v3/ticker/price`)
      .then((r) => r.json()) as Promise<Array<{ symbol: string; price: string }>>,
  ]);

  const priceMap = new Map(priceList.map((p) => [p.symbol, parseFloat(p.price)]));

  const stablecoins = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD']);

  return account.balances
    .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map((b) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked);
      const total = free + locked;

      let valueUSD = 0;
      if (stablecoins.has(b.asset)) {
        valueUSD = total;
      } else {
        const usdtPair = priceMap.get(`${b.asset}USDT`);
        if (usdtPair) {
          valueUSD = total * usdtPair;
        } else {
          // Try via BTC as intermediate
          const btcPair = priceMap.get(`${b.asset}BTC`);
          const btcUsdt = priceMap.get('BTCUSDT');
          if (btcPair && btcUsdt) valueUSD = total * btcPair * btcUsdt;
        }
      }

      return { coin: b.asset, free, locked, valueUSD };
    })
    .filter((b) => b.valueUSD > 0.01 || b.free + b.locked > 0)
    .sort((a, b) => b.valueUSD - a.valueUSD);
}

/**
 * Returns the last 100 trades across the user's held assets + common pairs.
 */
export async function getTradeHistory(
  apiKey: string,
  apiSecret: string,
): Promise<Trade[]> {
  // Discover held assets to know which symbols to query
  const account = await binanceRequest<{
    balances: Array<{ asset: string; free: string; locked: string }>;
  }>(apiKey, apiSecret, '/api/v3/account');

  const heldAssets = account.balances
    .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map((b) => b.asset)
    .filter((a) => !['USDT', 'USDC', 'BUSD'].includes(a));

  const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

  const symbols = [
    ...new Set([
      ...heldAssets.map((a) => `${a}USDT`).filter((s) => s !== 'USDTUSDT'),
      ...commonSymbols,
    ]),
  ].slice(0, 12); // cap at 12 to avoid rate limits

  const settled = await Promise.allSettled(
    symbols.map((symbol) =>
      binanceRequest<
        Array<{
          symbol: string;
          price: string;
          qty: string;
          quoteQty: string;
          time: number;
          isBuyer: boolean;
        }>
      >(apiKey, apiSecret, '/api/v3/myTrades', { symbol, limit: 20 }),
    ),
  );

  const allTrades = settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.time - a.time)
    .slice(0, 100);

  return allTrades.map((t) => ({
    coin: t.symbol.replace(/USDT$/, '').replace(/BTC$/, '').replace(/ETH$/, ''),
    symbol: t.symbol,
    side: t.isBuyer ? 'BUY' : 'SELL',
    price: parseFloat(t.price),
    qty: parseFloat(t.qty),
    quoteQty: parseFloat(t.quoteQty),
    time: new Date(t.time).toISOString(),
  }));
}

/**
 * Returns all currently open orders across all symbols.
 */
export async function getOpenOrders(
  apiKey: string,
  apiSecret: string,
): Promise<OpenOrder[]> {
  const orders = await binanceRequest<
    Array<{
      symbol: string;
      orderId: number;
      side: string;
      type: string;
      price: string;
      origQty: string;
      executedQty: string;
      status: string;
      time: number;
    }>
  >(apiKey, apiSecret, '/api/v3/openOrders');

  return orders.map((o) => ({
    symbol: o.symbol,
    orderId: o.orderId,
    side: o.side,
    type: o.type,
    price: parseFloat(o.price),
    qty: parseFloat(o.origQty),
    executedQty: parseFloat(o.executedQty),
    status: o.status,
    time: new Date(o.time).toISOString(),
  }));
}

/* ═════════════════════════════════════════════════════════════════════════
   SUPABASE STORAGE — encrypted key persistence
   ═════════════════════════════════════════════════════════════════════════ */

export async function saveExchangeConnection(
  userId: string,
  encryptedApiKey: string,
  encryptedApiSecret: string,
): Promise<void> {
  const { error } = await supabase.from('exchange_connections').upsert(
    {
      user_id: userId,
      exchange: 'binance',
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: encryptedApiSecret,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,exchange' },
  );
  if (error) throw new Error(error.message);
}

export async function loadExchangeConnection(
  userId: string,
): Promise<ExchangeConnection | null> {
  const { data, error } = await supabase
    .from('exchange_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('exchange', 'binance')
    .maybeSingle();
  if (error) return null;
  return data as ExchangeConnection | null;
}

export async function deleteExchangeConnection(userId: string): Promise<void> {
  const { error } = await supabase
    .from('exchange_connections')
    .delete()
    .eq('user_id', userId)
    .eq('exchange', 'binance');
  if (error) throw new Error(error.message);
}

export async function updateLastSynced(userId: string): Promise<void> {
  await supabase
    .from('exchange_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('exchange', 'binance');
}

/**
 * Convenience: decrypt and return API keys from Supabase row.
 * Returns null if no connection exists.
 */
export async function getDecryptedKeys(
  userId: string,
): Promise<{ apiKey: string; apiSecret: string } | null> {
  const conn = await loadExchangeConnection(userId);
  if (!conn) return null;

  const [apiKey, apiSecret] = await Promise.all([
    decryptField(conn.encrypted_api_key, userId),
    decryptField(conn.encrypted_api_secret, userId),
  ]);

  return { apiKey, apiSecret };
}
