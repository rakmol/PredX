import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ─── Device fingerprint ───────────────────────────────────────────────────────
// Simple deterministic fingerprint — no external lib needed.
export function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ].join('|');

  // djb2 hash → hex string
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export interface AuthProfile {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro';
  subscription_expires_at: string | null;
  devices: string[];
  created_at: string;
  updated_at: string;
}

/** Fetch the profile row for a given user id */
async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as AuthProfile;
}

/** Sign up — creates auth user + profile row (auto via trigger) */
export async function signUp(email: string, password: string, username: string) {
  // Check username uniqueness first
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    throw new Error('Username already taken. Please choose another.');
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Signup failed — no user returned.');

  // Update username (trigger creates row with email prefix, we override it)
  await supabase
    .from('profiles')
    .update({ username })
    .eq('id', data.user.id);

  const profile = await fetchProfile(data.user.id);
  return { user: data.user, session: data.session, profile };
}

/** Sign in — validates credentials + enforces 2-device limit */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Sign in failed.');

  const profile = await fetchProfile(data.user.id);
  if (!profile) throw new Error('Profile not found. Please contact support.');

  // ── Device limit check ──────────────────────────────────────────────────────
  const deviceId = getDeviceFingerprint();
  const devices: string[] = profile.devices ?? [];

  if (!devices.includes(deviceId)) {
    const maxDevices = profile.subscription_tier === 'pro' ? 2 : 1;
    if (devices.length >= maxDevices) {
      // Sign back out to keep session clean
      await supabase.auth.signOut();
      const tierLabel = profile.subscription_tier === 'free' ? 'Free (1 device)' : 'Pro (2 devices)';
      throw new Error(
        `DEVICE_LIMIT:Device limit reached for your ${tierLabel} plan. Remove a device in Settings to continue.`,
      );
    }
    // Register this device
    await supabase
      .from('profiles')
      .update({ devices: [...devices, deviceId] })
      .eq('id', data.user.id);

    profile.devices = [...devices, deviceId];
  }

  return { user: data.user, session: data.session, profile };
}

/** Sign out — removes this device from the profile's device list */
export async function signOut() {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const deviceId = getDeviceFingerprint();
    const profile = await fetchProfile(user.id);
    if (profile) {
      const updated = profile.devices.filter((d) => d !== deviceId);
      await supabase.from('profiles').update({ devices: updated }).eq('id', user.id);
    }
  }

  await supabase.auth.signOut();
}

/** Get current session + profile (used on app boot) */
export async function getCurrentUser(): Promise<{ profile: AuthProfile; token: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const profile = await fetchProfile(session.user.id);
  if (!profile) return null;

  return { profile, token: session.access_token };
}

/** Subscribe to auth state changes */
export function onAuthStateChange(
  callback: (event: string, profile: AuthProfile | null, token: string | null) => void,
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    window.setTimeout(async () => {
      if (session) {
        const profile = await fetchProfile(session.user.id);
        callback(event, profile, session.access_token);
      } else {
        callback(event, null, null);
      }
    }, 0);
  });
}
