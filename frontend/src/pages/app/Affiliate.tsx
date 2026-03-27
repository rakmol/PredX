// Affiliate — /affiliate
// Shows the user's referral link, referral count, and share options.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Copy, Check, Gift, Users, Share2, ExternalLink, Loader2,
} from 'lucide-react';
import { affiliateApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const APP_URL = 'https://predx-app.vercel.app';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AffiliatePage() {
  const profile = useAuthStore((s) => s.profile);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-stats', profile?.id],
    queryFn: affiliateApi.getStats,
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const refLink = data?.refCode ? `${APP_URL}/signup?ref=${data.refCode}` : '';

  const copy = () => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Join me on PredX — AI-powered crypto price predictions! Sign up free: ${refLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`Predicting crypto prices with AI on PredX 🚀 Sign up free using my link:`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(refLink)}`, '_blank');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-10">

      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          <Gift size={12} /> Affiliate Program
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Refer Friends, Grow Together</h1>
        <p className="mt-2 text-sm text-slate-400">
          Share your unique link. When someone signs up using it, they're tracked as your referral automatically.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <StatCard
          label="Total Referrals"
          value={isLoading ? '—' : String(data?.referralCount ?? 0)}
          sub="people signed up via your link"
        />
        <StatCard
          label="Your Ref Code"
          value={isLoading ? '—' : (data?.refCode?.toUpperCase() ?? '—')}
          sub="unique to your account"
        />
      </div>

      {/* Referral link card */}
      <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-6 mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Share2 size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-slate-100">Your Referral Link</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : refLink ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-[#1E3050] bg-[#050A14] px-4 py-3">
              <p className="flex-1 truncate font-mono text-xs text-slate-300">{refLink}</p>
              <button
                onClick={copy}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-brand/20"
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>

            {/* Share buttons */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={shareWhatsApp}
                className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20"
              >
                <ExternalLink size={13} /> Share on WhatsApp
              </button>
              <button
                onClick={shareTwitter}
                className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
              >
                <ExternalLink size={13} /> Share on X (Twitter)
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Your referral code is being generated. Check back shortly.</p>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-[#1E3050] bg-[#0D1526] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users size={15} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100">How It Works</h2>
        </div>
        <div className="space-y-4">
          {[
            { step: '01', title: 'Share your link', desc: 'Copy your unique referral link and share it with friends on WhatsApp, Twitter, or anywhere.' },
            { step: '02', title: 'They sign up', desc: 'When someone clicks your link and creates an account, they\'re automatically tracked as your referral.' },
            { step: '03', title: 'You grow together', desc: 'Every referral is counted on your dashboard. Future rewards will be based on your referral count.' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-xs font-extrabold text-brand">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-400 leading-5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
