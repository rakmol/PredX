import { useEffect, useState } from 'react'
import { Users, Brain, Bell, TrendingUp, Crown, AlertCircle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'

type Stats = Awaited<ReturnType<typeof api.stats>>

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{value.toLocaleString()}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.stats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error || 'Failed to load stats'}</span>
        </div>
      </div>
    )
  }

  const proRate = stats.users.total > 0
    ? Math.round((stats.users.pro / stats.users.total) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-500">Platform snapshot — live data from Supabase</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          sub={`${stats.users.free} free · ${stats.users.pro} pro`}
          icon={Users}
          color="bg-cyan-500/10 text-cyan-400"
        />
        <StatCard
          label="Pro Subscribers"
          value={stats.users.pro}
          sub={`${proRate}% conversion rate`}
          icon={Crown}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          label="Total Predictions"
          value={stats.predictions.total}
          icon={Brain}
          color="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          label="Total Alerts"
          value={stats.alerts.total}
          sub={`${stats.alerts.active} active`}
          icon={Bell}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Active Alerts"
          value={stats.alerts.active}
          icon={Bell}
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          label="Triggered Alerts"
          value={stats.alerts.triggered}
          icon={TrendingUp}
          color="bg-rose-500/10 text-rose-400"
        />
      </div>

      {/* Signup trend */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-200">New Signups — Last 7 Days</p>
          <p className="text-xs text-slate-500">Daily registration trend</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={stats.signupTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0d1829', border: '1px solid #1a2d4a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#22d3ee' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#signupGrad)"
              name="Signups"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* User tier breakdown */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5">
        <p className="mb-3 text-sm font-semibold text-slate-200">User Tier Breakdown</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Free tier</span>
              <span>{stats.users.free} users</span>
            </div>
            <div className="h-2 rounded-full bg-[#1a2d4a] overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-500 transition-all"
                style={{ width: stats.users.total > 0 ? `${(stats.users.free / stats.users.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Pro tier</span>
              <span>{stats.users.pro} users</span>
            </div>
            <div className="h-2 rounded-full bg-[#1a2d4a] overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: stats.users.total > 0 ? `${(stats.users.pro / stats.users.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
