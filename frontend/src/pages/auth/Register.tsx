import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { signUp } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

function validateUsername(v: string): string {
  if (v.length < 3) return 'At least 3 characters required.';
  if (v.length > 20) return 'Maximum 20 characters.';
  if (/\s/.test(v)) return 'No spaces allowed.';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores.';
  return '';
}

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (field === 'username') setUsernameError(validateUsername(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const uErr = validateUsername(form.username);
    if (uErr) { setUsernameError(uErr); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const { profile, session } = await signUp(form.email, form.password, form.username);

      if (session) {
        login(profile!, session.access_token);
        toast.success('Account created! Welcome to PredX.');
        navigate('/dashboard');
      } else {
        toast.success('Check your email to confirm your account.', { duration: 6000 });
        navigate('/login');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
    if (score === 2) return { label: 'Fair', color: 'bg-orange-400', width: 'w-2/4' };
    if (score === 3) return { label: 'Good', color: 'bg-yellow-400', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  })();

  return (
    <div className="min-h-screen bg-[#050A14] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="font-bold text-2xl gradient-text">PredX</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-100">Create your account</h1>
          <p className="text-sm text-slate-400 mt-1">Start predicting crypto prices with AI</p>
        </div>

        <div className="bg-[#0D1526] border border-[#1E3050] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                placeholder="you@example.com"
                className="w-full bg-[#050A14] border border-[#1E3050] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.username}
                  onChange={set('username')}
                  required
                  placeholder="satoshi_nakamoto"
                  maxLength={20}
                  className={`w-full bg-[#050A14] border rounded-xl px-4 py-3 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors ${
                    usernameError ? 'border-red-500/60 focus:border-red-500' : 'border-[#1E3050] focus:border-brand'
                  }`}
                />
                {form.username && !usernameError && (
                  <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
                )}
              </div>
              {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
              <p className="text-xs text-slate-600 mt-1">Letters, numbers, underscores. Min 3 chars. Burned into prediction watermarks.</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#050A14] border border-[#1E3050] rounded-xl px-4 py-3 pr-11 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordStrength && (
                <div className="mt-1.5">
                  <div className="h-1 bg-[#050A14] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${passwordStrength.color} ${passwordStrength.width}`} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{passwordStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.confirm}
                onChange={set('confirm')}
                required
                placeholder="••••••••"
                className={`w-full bg-[#050A14] border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors ${
                  form.confirm && form.confirm !== form.password
                    ? 'border-red-500/60'
                    : 'border-[#1E3050] focus:border-brand'
                }`}
              />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1">Passwords don't match.</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !!usernameError}
              className="w-full bg-brand hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-400 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:underline font-medium">Sign in</Link>
        </p>
        <p className="text-center text-xs text-slate-600 mt-3">
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
