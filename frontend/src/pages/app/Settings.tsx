/**
 * Settings — /settings
 *
 * Seven sections:
 *  1. Account          — display name, username, avatar upload, email, password
 *  2. Subscription     — plan badge, billing date, cancel / upgrade CTA
 *  3. Connected Exchanges — list, connect redirect, disconnect
 *  4. Devices          — active devices, remove (prevents account sharing)
 *  5. Alerts Prefs     — in-app / email toggles, separate alerts email
 *  6. Display          — default currency, default timeframe, language
 *  7. Privacy & Security — delete predictions, download data, delete account
 */

import {
  useRef, useState, useEffect, useCallback, type ChangeEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Mail, Lock, Monitor, Trash2,
  Bell, Globe, ShieldAlert, Camera, Save,
  X, ChevronRight, Link2,
  Download, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';

import { supabase, getDeviceFingerprint } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { timeAgo } from '@/lib/utils';
import type { ExchangeConnectionRow } from '@/pages/app/portfolioHelpers';

/* ─── LocalStorage preference keys ───────────────────────────────────────── */

const PREF = {
  currency:        'predx_default_currency',
  timeframe:       'predx_default_timeframe',
  alertInApp:      'predx_alert_inapp',
  alertEmail:      'predx_alert_email',
  alertEmailAddr:  'predx_alert_email_addr',
  refreshInterval: 'predx_chart_refresh_interval',
} as const;

const REFRESH_OPTS: { label: string; value: string }[] = [
  { label: 'Off', value: 'null' },
  { label: '10s', value: '10000' },
  { label: '30s', value: '30000' },
  { label: '1m',  value: '60000' },
  { label: '5m',  value: '300000' },
  { label: '15m', value: '900000' },
];

function getPref(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function setPref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

/* ─── Exchange logos ──────────────────────────────────────────────────────── */

const EXCHANGE_META: Record<string, { label: string; color: string }> = {
  binance: { label: 'Binance',  color: '#F0B90B' },
  bybit:   { label: 'Bybit',    color: '#F7A600' },
  kucoin:  { label: 'KuCoin',   color: '#23AF91' },
};

/* ─── Reusable primitives ─────────────────────────────────────────────────── */

function Section({
  id, icon: Icon, title, description, accent = 'brand', children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  description?: string;
  accent?: 'brand' | 'red';
  children: React.ReactNode;
}) {
  const accentCls = accent === 'red'
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  return (
    <div id={id} className="bg-[#0D1526] border border-[#1E3050] rounded-2xl overflow-hidden scroll-mt-20">
      <div className="px-6 py-4 border-b border-[#1E3050] flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${accentCls}`}>
          <Icon size={15} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] sm:items-start gap-2">
      <div className="pt-2.5">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        {hint && <p className="text-xs text-slate-600 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TInput({
  value, onChange, placeholder, type = 'text', disabled = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-xl border border-[#223556] bg-[#08111F] px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function SaveBtn({ onClick, saving, disabled }: { onClick: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={saving || disabled}
      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      Save
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors ${
        checked ? 'bg-blue-600 border-blue-600' : 'bg-[#1E3050] border-[#2a4070]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Divider() {
  return <div className="border-t border-[#1E3050]" />;
}

/* ─── Section nav pill list ───────────────────────────────────────────────── */

const NAV = [
  { id: 'account',      label: 'Account',    icon: User },
  { id: 'exchanges',    label: 'Exchanges',   icon: Link2 },
  { id: 'devices',      label: 'Devices',     icon: Monitor },
  { id: 'alerts-prefs', label: 'Alerts',      icon: Bell },
  { id: 'display',      label: 'Display',     icon: Globe },
  { id: 'privacy',      label: 'Privacy',     icon: ShieldAlert },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */

export default function Settings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { updateProfile, logout } = useAuthStore();

  /* ── 1. Account state ─────────────────────────────────────────────────── */
  const [displayName, setDisplayName] = useState(profile?.username ?? '');
  const [username, setUsername]       = useState(profile?.username ?? '');
  const [savingName, setSavingName]   = useState(false);

  const [newEmail, setNewEmail]       = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [savingPwd, setSavingPwd]     = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  /* ── 5. Alerts prefs state (localStorage) ────────────────────────────── */
  const [alertInApp,     setAlertInApp]     = useState(() => getPref(PREF.alertInApp, 'true') === 'true');
  const [alertEmail,     setAlertEmail]     = useState(() => getPref(PREF.alertEmail, 'false') === 'true');
  const [alertEmailAddr, setAlertEmailAddr] = useState(() => getPref(PREF.alertEmailAddr, profile?.email ?? ''));
  const [savingAlertAddr, setSavingAlertAddr] = useState(false);

  /* ── 6. Display prefs state (localStorage) ───────────────────────────── */
  const [currency,         setCurrency]         = useState(() => getPref(PREF.currency, 'GHS'));
  const [timeframe,        setTimeframe]        = useState(() => getPref(PREF.timeframe, '7d'));
  const [refreshInterval,  setRefreshInterval]  = useState(() => getPref(PREF.refreshInterval, '30000'));

  /* ── 7. Privacy state ────────────────────────────────────────────────── */
  const [deleteConfirm,  setDeleteConfirm]  = useState('');
  const [deleting,       setDeleting]       = useState(false);
  const [deletingPreds,  setDeletingPreds]  = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);

  /* ── Exchanges query ─────────────────────────────────────────────────── */
  const {
    data: exchanges = [],
    isLoading: exchLoading,
    refetch: refetchExch,
  } = useQuery<ExchangeConnectionRow[]>({
    queryKey: ['exchange-connections', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from('exchange_connections')
        .select('id, exchange, last_synced_at, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });
      return (data ?? []) as ExchangeConnectionRow[];
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  if (!profile) return null;

  const thisDeviceId = getDeviceFingerprint();
  const devices: string[] = profile.devices ?? [];

  /* ── Detect OS/browser from UA for a friendlier device label ─────────── */
  function deviceLabel(id: string): string {
    if (id !== thisDeviceId) return 'Another device';
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
    if (/Android/.test(ua))     return 'Android device';
    if (/Mac/.test(ua))         return 'Mac';
    if (/Windows/.test(ua))     return 'Windows PC';
    if (/Linux/.test(ua))       return 'Linux';
    return 'Unknown device';
  }

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  /* Avatar upload */
  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Avatar must be under 2 MB.'); return; }

    setAvatarUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${profile.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      updateProfile({ avatar_url: publicUrl });
      toast.success('Avatar updated.');
    } catch {
      toast.error('Upload failed. Check storage bucket permissions.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }

  /* Save display name / username */
  async function handleSaveName() {
    const trimmed = username.trim();
    if (!trimmed) return;
    if (trimmed.length < 3) { toast.error('Username must be at least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { toast.error('Only letters, numbers, and underscores.'); return; }

    setSavingName(true);
    try {
      const { data: clash } = await supabase
        .from('profiles').select('id').eq('username', trimmed).neq('id', profile.id).maybeSingle();
      if (clash) { toast.error('Username already taken.'); return; }

      const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', profile.id);
      if (error) throw error;
      updateProfile({ username: trimmed });
      toast.success('Username updated.');
    } catch {
      toast.error('Failed to save username.');
    } finally {
      setSavingName(false);
    }
  }

  /* Change email */
  async function handleChangeEmail() {
    if (!/\S+@\S+\.\S+/.test(newEmail)) { toast.error('Enter a valid email address.'); return; }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('Confirmation email sent — check your new inbox.');
      setNewEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email update failed.');
    } finally {
      setSavingEmail(false);
    }
  }

  /* Change password */
  async function handleChangePassword() {
    if (newPwd.length < 8)     { toast.error('Password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match.'); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success('Password changed.');
      setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setSavingPwd(false);
    }
  }

  /* Remove device */
  async function handleRemoveDevice(deviceId: string) {
    const updated = devices.filter((d) => d !== deviceId);
    const { error } = await supabase.from('profiles').update({ devices: updated }).eq('id', profile.id);
    if (error) { toast.error('Could not remove device.'); return; }

    updateProfile({ devices: updated });
    toast.success('Device removed.');

    if (deviceId === thisDeviceId) {
      await supabase.auth.signOut();
      logout();
      navigate('/login', { replace: true });
    }
  }

  /* Disconnect exchange */
  async function handleDisconnectExchange(id: string, name: string) {
    const { error } = await supabase.from('exchange_connections').delete().eq('id', id);
    if (error) { toast.error(`Failed to disconnect ${name}.`); return; }
    toast.success(`${name} disconnected.`);
    refetchExch();
  }

  /* Alert prefs — persist immediately on change */
  function toggleAlertInApp(v: boolean) {
    setAlertInApp(v);
    setPref(PREF.alertInApp, String(v));
  }
  function toggleAlertEmail(v: boolean) {
    setAlertEmail(v);
    setPref(PREF.alertEmail, String(v));
  }
  function saveAlertEmail() {
    if (alertEmailAddr && !/\S+@\S+\.\S+/.test(alertEmailAddr)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setSavingAlertAddr(true);
    setPref(PREF.alertEmailAddr, alertEmailAddr);
    setTimeout(() => { setSavingAlertAddr(false); toast.success('Alert email saved.'); }, 400);
  }

  /* Display prefs */
  function handleCurrency(c: string) { setCurrency(c); setPref(PREF.currency, c); toast.success('Default currency updated.'); }
  function handleTimeframe(t: string) { setTimeframe(t); setPref(PREF.timeframe, t); toast.success('Default timeframe updated.'); }
  function handleRefreshInterval(v: string) { setRefreshInterval(v); setPref(PREF.refreshInterval, v); toast.success('Default refresh interval updated.'); }

  /* Delete all predictions */
  async function handleDeletePredictions() {
    setDeletingPreds(true);
    try {
      // predictions table keyed by user_id — remove cached rows
      const { error } = await supabase.from('predictions').delete().eq('user_id', profile.id);
      if (error) throw error;
      toast.success('All your predictions cleared.');
    } catch {
      toast.error('Could not delete predictions. Contact support.');
    } finally {
      setDeletingPreds(false);
    }
  }

  /* Download my data */
  async function handleDownloadData() {
    setDownloadingData(true);
    try {
      const [
        { data: profileData },
        { data: alertsData },
        { data: exchData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', profile.id).single(),
        supabase.from('alerts').select('*').eq('user_id', profile.id),
        supabase.from('exchange_connections').select('id, exchange, created_at, last_synced_at').eq('user_id', profile.id),
      ]);

      const blob = new Blob([JSON.stringify({
        exported_at: new Date().toISOString(),
        profile: profileData,
        alerts: alertsData ?? [],
        exchange_connections: exchData ?? [],
      }, null, 2)], { type: 'application/json' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `predx-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported.');
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setDownloadingData(false);
    }
  }

  /* Delete account */
  async function handleDeleteAccount() {
    if (deleteConfirm !== profile.username) {
      toast.error(`Type "${profile.username}" exactly to confirm.`);
      return;
    }
    setDeleting(true);
    try {
      await supabase.functions.invoke('delete-account', { body: { userId: profile.id } });
      await supabase.auth.signOut();
      logout();
      navigate('/', { replace: true });
    } catch {
      toast.error('Deletion failed — contact support@predx.app.');
      setDeleting(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-10">

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Sticky section nav */}
      <div className="sticky top-16 z-20 -mx-4 px-4 py-2 bg-[#050A14]/90 backdrop-blur-md border-b border-[#1E3050] mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {NAV.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <Icon size={12} />
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-6">

        {/* ═══════════════════════════════════════════
            1. ACCOUNT
        ═══════════════════════════════════════════ */}
        <Section id="account" icon={User} title="Account" description="Your profile and credentials.">

          {/* Avatar */}
          <Field label="Avatar">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-16 h-16 rounded-full border-2 border-[#1E3050] object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-[#1E3050] bg-blue-500/20 flex items-center justify-center text-xl font-bold text-blue-300">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <Loader2 size={18} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={() => avatarInput.current?.click()}
                  disabled={avatarUploading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#223556] bg-[#08111F] text-sm text-slate-300 hover:text-slate-100 hover:border-blue-500/40 transition-colors disabled:opacity-50"
                >
                  <Camera size={14} />
                  {avatarUploading ? 'Uploading…' : 'Change photo'}
                </button>
                <p className="text-xs text-slate-600 mt-1">JPG, PNG, GIF · max 2 MB</p>
              </div>
              <input
                ref={avatarInput} type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </Field>

          <Divider />

          {/* Username */}
          <Field label="Username" hint="Letters, numbers, underscores only.">
            <div className="flex gap-2">
              <TInput value={username} onChange={setUsername} placeholder="your_username" />
              <SaveBtn onClick={handleSaveName} saving={savingName} disabled={username.trim() === profile.username} />
            </div>
          </Field>

          <Divider />

          {/* Current email (read-only) */}
          <Field label="Email">
            <TInput value={profile.email} onChange={() => {}} disabled />
          </Field>

          {/* Change email */}
          <Field label="New email" hint="A confirmation link will be sent.">
            <div className="flex gap-2">
              <TInput value={newEmail} onChange={setNewEmail} placeholder="new@email.com" type="email" />
              <button
                onClick={handleChangeEmail}
                disabled={savingEmail || !newEmail}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
              >
                {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send
              </button>
            </div>
          </Field>

          <Divider />

          {/* Change password */}
          <Field label="New password" hint="Min 8 characters.">
            <div className="space-y-2">
              <TInput value={newPwd} onChange={setNewPwd} placeholder="New password" type="password" />
              <TInput value={confirmPwd} onChange={setConfirmPwd} placeholder="Confirm password" type="password" />
              <button
                onClick={handleChangePassword}
                disabled={savingPwd || !newPwd || !confirmPwd}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A2940] hover:bg-[#223a60] disabled:opacity-40 text-slate-200 rounded-xl text-sm font-medium transition-colors border border-[#223556]"
              >
                {savingPwd ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {savingPwd ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </Field>

        </Section>

        {/* ═══════════════════════════════════════════
            2. CONNECTED EXCHANGES
        ═══════════════════════════════════════════ */}
        <Section
          id="exchanges" icon={Link2}
          title="Connected Exchanges"
          description="Your live exchange connections for portfolio tracking."
        >
          {exchLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 size={14} className="animate-spin" /> Loading exchanges…
            </div>
          ) : (
            <>
              {exchanges.length === 0 ? (
                <p className="text-sm text-slate-500">No exchanges connected yet.</p>
              ) : (
                <ul className="space-y-2">
                  {exchanges.map((ex) => {
                    const meta = EXCHANGE_META[ex.exchange] ?? { label: ex.exchange, color: '#64748b' };
                    return (
                      <li key={ex.id} className="flex items-center justify-between rounded-xl border border-[#1E3050] bg-[#08111F] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                            style={{ background: meta.color }}
                          >
                            {meta.label[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{meta.label}</p>
                            <p className="text-xs text-slate-600">
                              {ex.last_synced_at ? `Last synced ${timeAgo(ex.last_synced_at)}` : `Added ${timeAgo(ex.created_at)}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnectExchange(ex.id, meta.label)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                        >
                          Disconnect
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Link
                to="/portfolio"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ChevronRight size={14} /> Connect a new exchange in Portfolio
              </Link>
            </>
          )}
        </Section>

        {/* ═══════════════════════════════════════════
            4. DEVICES
        ═══════════════════════════════════════════ */}
        <Section
          id="devices" icon={Monitor}
          title="Active Devices"
          description="Active devices. Remove a device to force re-authentication."
        >
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">No devices registered.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((deviceId, i) => {
                const isThis = deviceId === thisDeviceId;
                return (
                  <li
                    key={deviceId}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      isThis ? 'border-blue-500/30 bg-blue-500/5' : 'border-[#1E3050] bg-[#08111F]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Monitor size={15} className={isThis ? 'text-blue-400' : 'text-slate-500'} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-200">
                            {isThis ? deviceLabel(deviceId) : `Device ${i + 1}`}
                          </p>
                          {isThis && (
                            <span className="text-xs font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/20 rounded-full px-2 py-0.5">
                              This device
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          {deviceId.slice(0, 8)}…{deviceId.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDevice(deviceId)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                      title={isThis ? 'Remove — you will be signed out' : 'Remove device'}
                    >
                      <X size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-slate-600">
            Removing your own device signs you out immediately. Removing another device forces it to re-authenticate.
          </p>
        </Section>

        {/* ═══════════════════════════════════════════
            5. ALERTS PREFERENCES
        ═══════════════════════════════════════════ */}
        <Section id="alerts-prefs" icon={Bell} title="Alert Preferences" description="How you receive price alert notifications.">

          {/* In-app toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">In-app notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Shown in the alerts panel while you're in the app.</p>
            </div>
            <Toggle checked={alertInApp} onChange={toggleAlertInApp} />
          </div>

          <Divider />

          {/* Email toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Email notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Receive an email when an alert triggers.</p>
            </div>
            <Toggle checked={alertEmail} onChange={toggleAlertEmail} />
          </div>

          {/* Alert email address */}
          {alertEmail && (
            <Field label="Alert email" hint="Can be different from your account email.">
              <div className="flex gap-2">
                <TInput
                  value={alertEmailAddr}
                  onChange={setAlertEmailAddr}
                  placeholder={profile.email}
                  type="email"
                />
                <SaveBtn onClick={saveAlertEmail} saving={savingAlertAddr} />
              </div>
            </Field>
          )}

        </Section>

        {/* ═══════════════════════════════════════════
            6. DISPLAY
        ═══════════════════════════════════════════ */}
        <Section id="display" icon={Globe} title="Display" description="Personalise how PredX presents information.">

          {/* Default currency */}
          <Field label="Default currency" hint="Used for price display throughout the app.">
            <div className="flex gap-2">
              {(['GHS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCurrency(c)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    currency === c
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-[#08111F] border-[#223556] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c === 'GHS' ? '₵ GHS' : '$ USD'}
                </button>
              ))}
            </div>
          </Field>

          <Divider />

          {/* Default prediction timeframe */}
          <Field label="Default timeframe" hint="Pre-selected on the prediction page.">
            <div className="flex gap-2">
              {(['24h', '7d', '30d', '90d'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTimeframe(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    timeframe === t
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-[#08111F] border-[#223556] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>

          <Divider />

          {/* Default chart refresh interval */}
          <Field label="Chart refresh" hint="How often charts poll for new price data.">
            <div className="flex flex-wrap gap-1.5">
              {REFRESH_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRefreshInterval(opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    refreshInterval === opt.value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-[#08111F] border-[#223556] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              WebSocket-connected coins update in real time regardless of this setting.
            </p>
          </Field>

          <Divider />

          {/* Language */}
          <Field label="Language">
            <div className="flex items-center justify-between rounded-xl border border-[#223556] bg-[#08111F] px-4 py-2.5">
              <span className="text-sm text-slate-300">English</span>
              <span className="text-xs text-slate-600">Twi coming soon</span>
            </div>
          </Field>

        </Section>

        {/* ═══════════════════════════════════════════
            7. PRIVACY & SECURITY
        ═══════════════════════════════════════════ */}
        <Section
          id="privacy" icon={ShieldAlert}
          title="Privacy & Security"
          accent="red"
          description="Manage your data and account security."
        >

          {/* Delete all predictions */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Delete all predictions</p>
              <p className="text-xs text-slate-500 mt-0.5">Clears your saved AI prediction history. Cannot be undone.</p>
            </div>
            <button
              onClick={handleDeletePredictions}
              disabled={deletingPreds}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/25 bg-red-500/5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            >
              {deletingPreds ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
          </div>

          <Divider />

          {/* Download my data */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Download my data</p>
              <p className="text-xs text-slate-500 mt-0.5">Export your profile, alerts, and exchange connections as JSON.</p>
            </div>
            <button
              onClick={handleDownloadData}
              disabled={downloadingData}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#223556] bg-[#08111F] text-sm text-slate-300 hover:text-slate-100 disabled:opacity-40 transition-colors"
            >
              {downloadingData ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export
            </button>
          </div>

          <Divider />

          {/* Delete account */}
          <div>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Delete account</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanently removes your account, predictions, alerts, and all data. This cannot be undone.{' '}
                  Type <span className="font-mono text-slate-300">"{profile.username}"</span> to confirm.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={profile.username}
                className="flex-1 rounded-xl border border-red-500/30 bg-[#08111F] px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-red-500/60"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== profile.username}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

        </Section>

      </div>
    </div>
  );
}
