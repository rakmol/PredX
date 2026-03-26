import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Brain,
  Bell,
  Wallet,
  LineChart,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  Search,
  Activity,
  Sparkles,
  Link2,
  Gift,
  Lock,
} from 'lucide-react';
import PhoneMockup from '@/components/landing/PhoneMockup';

const STATS = [
  { value: '10,000+', label: 'Predictions Made' },
  { value: '50+', label: 'Coins Covered' },
  { value: 'GHS & USD', label: 'Dual Currency' },
  { value: 'Binance ✓', label: 'Exchange Connected' },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Price Prediction',
    desc: 'Get 24h, 7d, 30d, and 90d forecasts powered by Claude AI reasoning across 50+ market signals.',
    color: 'text-brand',
    bg: 'bg-brand/10',
    border: 'border-brand/20',
  },
  {
    icon: LineChart,
    title: 'Technical Analysis',
    desc: 'Full RSI, MACD, Bollinger Bands, and moving averages computed in real time.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Activity,
    title: 'Sentiment Analysis',
    desc: 'News sentiment, social mood scoring, and the Fear and Greed Index fused into one signal.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  {
    icon: Wallet,
    title: 'Exchange Analysis ★',
    desc: 'Connect Binance, Bybit, or KuCoin in read-only mode and let AI review your real holdings and trading patterns.',
    color: 'text-[#F0B90B]',
    bg: 'bg-[#F0B90B]/10',
    border: 'border-[#F0B90B]/30',
  },
  {
    icon: Sparkles,
    title: 'Investment Advisor',
    desc: 'Enter your budget in GHS or USD and get a full allocation plan with bull, base, and bear scenarios.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  {
    icon: Bell,
    title: 'Price Alerts',
    desc: 'Set alerts for any coin and get notified the moment price crosses your target.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
];

const STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Search any coin',
    desc: 'Pick from 50+ cryptocurrencies including Bitcoin, Ethereum, Solana, and more.',
  },
  {
    step: '02',
    icon: Zap,
    title: 'AI analyzes 50+ signals',
    desc: 'Technical indicators, sentiment, on-chain data, and macro signals processed in seconds.',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Get your prediction',
    desc: 'Receive a full forecast with three scenarios, confidence score, risks, and action points.',
  },
];

const FREE_FEATURES = [
  'Top 10 coins only',
  'Blurred prediction preview',
  '1 price alert',
  '1 device',
  'Basic market data',
];

const PRO_FEATURES = [
  'All 50+ coins - unlimited',
  'Full AI predictions (24h / 7d / 30d / 90d)',
  'AI Investment Advisor',
  'Exchange account analysis',
  'Unlimited price alerts',
  'Portfolio tracker + behavior coaching',
  '2 devices',
  'Priority support',
];

const COIN_GHOSTS = [
  { symbol: 'BTC', x: '8%', y: '18%', size: 70, delay: '0s', dur: '14s' },
  { symbol: 'ETH', x: '87%', y: '14%', size: 60, delay: '1.2s', dur: '16s' },
  { symbol: 'SOL', x: '83%', y: '58%', size: 54, delay: '2.1s', dur: '15s' },
];

function LandingNav() {
  return (
    <nav className="absolute left-0 right-0 top-0 z-10">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand shadow-lg shadow-brand/30">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="gradient-text text-xl font-bold">PredX</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition-colors hover:text-slate-200">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-slate-200">How It Works</a>
          <a href="#connect-exchange" className="flex items-center gap-1.5 font-semibold text-[#F0B90B] transition-opacity hover:opacity-80">
            <Link2 size={13} />
            Connect Binance
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200 md:block"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand/90"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden bg-[#050A14] text-slate-200">
      <section className="relative flex min-h-screen flex-col">
        <LandingNav />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="pointer-events-none absolute left-1/4 top-2/3 h-[300px] w-[300px] rounded-full bg-cyan-500/8 blur-[100px]" />

        {COIN_GHOSTS.map((coin) => (
          <div
            key={coin.symbol}
            className="pointer-events-none absolute select-none opacity-[0.05]"
            style={{
              left: coin.x,
              top: coin.y,
              animation: `coinDrift ${coin.dur} linear infinite`,
              animationDelay: coin.delay,
            }}
          >
            <div
              className="flex items-center justify-center rounded-full border border-white/10 bg-[#0D1526]/40 backdrop-blur-sm"
              style={{ width: coin.size, height: coin.size }}
            >
              <span className="text-sm font-extrabold tracking-[0.22em] text-white">{coin.symbol}</span>
            </div>
          </div>
        ))}

        <div className="relative z-[1] flex-1 px-6 pb-16 pt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.82fr)] lg:gap-10">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
                Powered by Claude AI - Live market data
              </div>

              <h1 className="mb-6 text-4xl font-extrabold leading-tight text-slate-100 sm:text-5xl md:text-6xl">
                Predict Crypto. <span className="gradient-text">Smarter Than</span> the Market.
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 lg:mx-0">
                AI-powered price predictions combining technical analysis, sentiment, on-chain data, and real-time reasoning.
                Built for West Africa and the world.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                <Link
                  to="/signup"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-brand/40 sm:w-auto"
                >
                  Start Free
                  <ArrowRight size={18} />
                </Link>
                <a
                  href="#how-it-works"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E3050] px-8 py-3.5 text-base font-semibold text-slate-300 transition-all hover:border-brand/50 hover:bg-white/3 hover:text-slate-100 sm:w-auto"
                >
                  See How It Works
                </a>
              </div>

              <p className="mt-8 text-xs text-slate-600">
                No credit card required - Free plan available - Cancel anytime
              </p>
            </div>

            <div className="hidden justify-center md:flex lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>

        <div className="relative z-[1] flex justify-center pb-8 animate-bounce">
          <ChevronRight size={20} className="rotate-90 text-slate-600" />
        </div>
      </section>

      <section className="border-y border-[#1E3050] bg-[#0D1526]/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-0 md:divide-x divide-[#1E3050]">
            {STATS.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center px-4 text-center">
                <span className="mb-1 text-2xl font-extrabold text-slate-100 md:text-3xl">{value}</span>
                <span className="text-sm text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          BINANCE CONNECT — Prominent Section
      ═══════════════════════════════════════ */}
      <section id="connect-exchange" className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {/* Main connect card */}
          <div className="relative overflow-hidden rounded-3xl border border-[#F0B90B]/25 bg-gradient-to-br from-[#0D1526] via-[#0D1526] to-[#0A0F1A] p-8 lg:p-12">
            {/* Gold glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#F0B90B]/8 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-[#F0B90B]/5 blur-[60px]" />

            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              {/* Left content */}
              <div>
                {/* Badge */}
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F0B90B]/30 bg-[#F0B90B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#F0B90B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" />
                  Exchange Integration · Read-Only · Secure
                </div>

                <h2 className="mb-3 text-2xl font-extrabold text-slate-100 md:text-3xl">
                  Connect Your Binance Account —{' '}
                  <span className="text-[#F0B90B]">See the Full Picture</span>
                </h2>
                <p className="mb-6 max-w-xl text-slate-400 leading-relaxed">
                  Link your Binance exchange in read-only mode. PredX pulls your real portfolio
                  and overlays AI predictions on your actual holdings — so every forecast is personal to you.
                  Your API keys are <strong className="text-slate-300">AES-256 encrypted</strong> and never used to place trades.
                </p>

                {/* Trust bullets */}
                <div className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    { icon: Lock, text: 'Read-only access — no trade permissions' },
                    { icon: Shield, text: 'AES-256 encrypted keys stored securely' },
                    { icon: Wallet, text: 'Supports Binance, Bybit & KuCoin' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-2.5 rounded-xl border border-[#1E3050] bg-[#0A1020] px-3.5 py-3">
                      <Icon size={14} className="mt-0.5 flex-shrink-0 text-[#F0B90B]" />
                      <span className="text-xs leading-relaxed text-slate-400">{text}</span>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/portfolio"
                    className="flex items-center gap-2 rounded-xl bg-[#F0B90B] px-6 py-3 text-sm font-bold text-[#0A0F1A] shadow-lg shadow-[#F0B90B]/20 transition-all hover:-translate-y-0.5 hover:bg-[#F0B90B]/90 hover:shadow-[#F0B90B]/35"
                  >
                    <Link2 size={15} />
                    Connect Binance → View My Portfolio
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center gap-2 rounded-xl border border-[#1E3050] px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-[#F0B90B]/40 hover:text-slate-100"
                  >
                    Create Account First
                  </Link>
                </div>
              </div>

              {/* Right — stats */}
              <div className="hidden lg:flex flex-col gap-3 min-w-[180px]">
                {[
                  { value: '3', label: 'Exchanges Supported' },
                  { value: '< 30s', label: 'Setup Time' },
                  { value: '0', label: 'Trade Permissions' },
                ].map(({ value, label }) => (
                  <div key={label} className="rounded-xl border border-[#F0B90B]/15 bg-[#F0B90B]/5 px-5 py-4 text-center">
                    <p className="text-xl font-extrabold text-[#F0B90B]">{value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Affiliate row — below the main card */}
          <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/15">
              <Gift size={18} className="text-brand" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">Affiliate Rewards Program</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Share your unique referral link and earn rewards every time someone signs up and connects their exchange through your link.
                Affiliates earn a commission on each Pro subscription their referrals activate — tracked automatically.
              </p>
            </div>
            <Link
              to="/signup"
              className="flex-shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-semibold text-brand transition-all hover:bg-brand/20 whitespace-nowrap"
            >
              Join & Get Your Link →
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Features</p>
            <h2 className="mb-4 text-3xl font-extrabold text-slate-100 md:text-4xl">
              Everything you need to trade smarter
            </h2>
            <p className="mx-auto max-w-xl text-slate-400">
              Professional-grade crypto analysis tools previously reserved for institutional traders.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div key={title} className={`group card-hover relative rounded-2xl border bg-[#0D1526] p-6 ${border}`}>
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-100">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at top left, rgba(59,130,246,0.04), transparent 60%)' }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#0D1526]/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">How It Works</p>
            <h2 className="mb-4 text-3xl font-extrabold text-slate-100 md:text-4xl">
              From search to strategy in seconds
            </h2>
            <p className="text-slate-400">Three steps. Zero guesswork.</p>
          </div>

          <div className="relative">
            <div className="absolute left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] top-12 hidden h-px bg-gradient-to-r from-[#1E3050] via-brand/40 to-[#1E3050] md:block" />

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {STEPS.map(({ step, icon: Icon, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="glow-blue flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
                      <Icon size={24} className="text-brand" />
                    </div>
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-brand/40 bg-[#050A14] text-xs font-bold text-brand">
                      {step.replace('0', '')}
                    </span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-slate-100">{title}</h3>
                  <p className="max-w-xs text-sm leading-relaxed text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand/90"
            >
              Try It Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>


      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-brand/5" />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-extrabold text-slate-100 md:text-4xl">
            Ready to predict smarter?
          </h2>
          <p className="mb-8 text-slate-400">
            Join thousands of traders using AI to navigate the crypto market with confidence.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-10 py-4 text-base font-bold text-white shadow-xl shadow-brand/30 transition-all hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-brand/50"
          >
            Create Free Account <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#1E3050] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                  <TrendingUp size={16} className="text-white" />
                </div>
                <span className="gradient-text text-lg font-bold">PredX</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                AI-powered crypto prediction platform built for West Africa and the world. Professional analysis tools for every trader.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-600">
                <Globe size={13} />
                Made in Ghana
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Product</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Markets', to: '/' },
                  { label: 'AI Predictions', to: '/predict' },
                  { label: 'Advisor', to: '/advisor' },
                  { label: 'Portfolio', to: '/portfolio' },
                ].map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className="text-sm text-slate-500 transition-colors hover:text-slate-300">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</p>
              <ul className="space-y-2.5">
                {['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Disclaimer'].map((item) => (
                  <li key={item}>
                    <span className="cursor-pointer text-sm text-slate-500 transition-colors hover:text-slate-300">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#1E3050] pt-6 sm:flex-row">
            <p className="text-xs text-slate-600">(c) {new Date().getFullYear()} PredX. All rights reserved.</p>
            <p className="text-xs text-slate-600">Not financial advice. Always do your own research.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes coinDrift {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          33% { transform: translate3d(10px, -14px, 0) rotate(8deg); }
          66% { transform: translate3d(-8px, 10px, 0) rotate(-6deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
