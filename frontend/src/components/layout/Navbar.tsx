// Navbar — top navigation

import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Bell, BarChart2, Brain, Search, X, LogOut,
  LayoutDashboard, ChevronDown, User, Settings, Gift,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts, useAlertChecker } from '@/hooks/useAlerts';
import { useSearchCoins, useTopCoins } from '@/hooks/useCoins';
import { formatPrice, formatPct } from '@/lib/utils';

/* ─── Nav items ─────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portfolio',  label: 'Portfolio',  icon: BarChart2 },
  { to: '/alerts',     label: 'Alerts',     icon: Bell },
  { to: '/advisor',    label: 'Advisor',    icon: Brain },
];

/* ─── Avatar initials ─────────────────────────────────────────────── */

function Initials({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full border border-white/20 object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/15 text-xs font-bold text-cyan-300">
      {initials || <User size={14} />}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAuthenticated, signOut } = useAuth();
  const { alerts } = useAlerts({ enabled: isAuthenticated });
  useAlertChecker(isAuthenticated);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Avatar dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useSearchCoins(query);
  const { data: topCoins } = useTopCoins(100);
  const topCoinsMap = new Map(topCoins?.map((c) => [c.id, c]) ?? []);

  /* ── Auto-focus search input ── */
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  /* ── Close search + dropdown on click-outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setQuery('');
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Close on route change ── */
  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleSignOutClick = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  const showResults = query.trim().length >= 2 && (searchResults?.length ?? 0) > 0;
  const activeAlertCount = alerts.filter((alert) => alert.is_active && !alert.triggered_at).length;

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1E3050] bg-[#050A14]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">

        {/* Logo */}
        <Link to="/dashboard" className="flex flex-shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]">
            <TrendingUp size={17} className="text-white" />
          </div>
          <span className="gradient-text text-xl font-bold">PredX</span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active =
              location.pathname === to ||
              (to !== '/dashboard' && location.pathname.startsWith(to));
            const isAlertsLink = to === '/alerts';
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#3B82F6]/15 text-[#60A5FA]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span className="relative">
                  <Icon size={15} />
                  {isAlertsLink && activeAlertCount > 0 && (
                    <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-none text-slate-950">
                      {activeAlertCount > 99 ? '99+' : activeAlertCount}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Search */}
          <div ref={searchRef} className="relative">
            {searchOpen ? (
              <div className="relative">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search coins..."
                  className="w-48 rounded-xl border border-[#1E3050] bg-[#0D1526] px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-cyan-400/60 md:w-60"
                />
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setQuery(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={13} />
                </button>

                {/* Results dropdown */}
                {showResults && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-2xl border border-[#1E3050] bg-[#0D1526] shadow-2xl">
                    {searchResults!.slice(0, 6).map((coin) => {
                      const md = topCoinsMap.get(coin.id);
                      const positive = (md?.price_change_percentage_24h ?? 0) >= 0;
                      return (
                        <Link
                          key={coin.id}
                          to={`/coin/${coin.id}`}
                          onClick={() => { setSearchOpen(false); setQuery(''); }}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                        >
                          <img
                            src={coin.thumb}
                            alt={coin.name}
                            className="h-7 w-7 rounded-full border border-white/10 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{coin.name}</p>
                            <p className="text-xs uppercase text-slate-500">{coin.symbol}</p>
                          </div>
                          {md && (
                            <div className="flex-shrink-0 text-right">
                              <p className="font-mono text-xs font-medium text-slate-200">
                                {formatPrice(md.current_price, 'USD', true)}
                              </p>
                              <p className={`text-xs ${positive ? 'text-green-400' : 'text-red-400'}`}>
                                {formatPct(md.price_change_percentage_24h)}
                              </p>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
              >
                <Search size={17} />
              </button>
            )}
          </div>

          {/* Authenticated user section */}
          {isAuthenticated && profile ? (
            <>
              {/* Avatar + dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-xl p-1 transition-colors hover:bg-white/5"
                >
                  <Initials name={profile.username} avatarUrl={profile.avatar_url} />
                  <ChevronDown
                    size={13}
                    className={`hidden text-slate-500 transition-transform duration-200 sm:block ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-[#1E3050] bg-[#0D1526] py-1 shadow-2xl">
                    {/* User info header */}
                    <div className="border-b border-[#1E3050] px-4 py-3">
                      <p className="text-sm font-semibold text-slate-100">{profile.username}</p>
                      <p className="truncate text-xs text-slate-500">{profile.email}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100"
                      >
                        <User size={14} className="text-slate-500" />
                        Profile
                      </Link>
                      <Link
                        to="/affiliate"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100"
                      >
                        <Gift size={14} className="text-brand" />
                        Affiliate
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100"
                      >
                        <Settings size={14} className="text-slate-500" />
                        Settings
                      </Link>
                    </div>

                    <div className="border-t border-[#1E3050] py-1">
                      <button
                        type="button"
                        onClick={() => void handleSignOutClick()}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Guest links */
            <>
              <Link
                to="/login"
                className="hidden text-sm text-slate-400 transition-colors hover:text-slate-200 md:block"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-xl bg-[#3B82F6] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB]"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1E3050] bg-[#050A14]/95 backdrop-blur-md md:hidden">
        <div className="flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            const isAlertsLink = to === '/alerts';
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? 'text-[#60A5FA]' : 'text-slate-500'
                }`}
              >
                <span className="relative">
                  <Icon size={20} />
                  {isAlertsLink && activeAlertCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-none text-slate-950">
                      {activeAlertCount > 99 ? '99+' : activeAlertCount}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
