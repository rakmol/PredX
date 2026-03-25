import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { api, type Prediction } from '../lib/api'

const SIGNAL_STYLE: Record<string, string> = {
  strong_buy:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  buy:         'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  hold:        'border-slate-500/30 bg-slate-700/20 text-slate-400',
  sell:        'border-orange-500/30 bg-orange-500/10 text-orange-400',
  strong_sell: 'border-red-500/30 bg-red-500/10 text-red-400',
}

function SignalBadge({ signal }: { signal: string }) {
  const style = SIGNAL_STYLE[signal] ?? SIGNAL_STYLE.hold
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {signal.replace('_', ' ').toUpperCase()}
    </span>
  )
}

const SIGNALS = ['', 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell']

export default function Predictions() {
  const [data, setData] = useState<Prediction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [signal, setSignal] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const load = useCallback(() => {
    setLoading(true)
    api.predictions.list(page, LIMIT, signal || undefined)
      .then((r) => { setData(r.data); setTotal(r.total) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, signal])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Predictions</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} total AI predictions generated</p>
        </div>

        {/* Signal filter */}
        <select
          value={signal}
          onChange={(e) => { setSignal(e.target.value); setPage(1) }}
          className="rounded-lg border border-[#1e3050] bg-[#0d1829] px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-500/50 transition-all"
        >
          {SIGNALS.map((s) => (
            <option key={s} value={s}>{s ? s.replace('_', ' ').toUpperCase() : 'All signals'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] overflow-hidden">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-red-400">
            <AlertCircle size={16} /> <span className="text-sm">{error}</span>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No predictions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2d4a] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Coin</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Timeframe</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Signal</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Confidence</th>
                <th className="hidden lg:table-cell px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-[#1a2d4a]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{p.coin_name}</p>
                    <p className="text-xs uppercase text-slate-500">{p.coin_symbol}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#1e3050] bg-[#0d1829] px-2 py-0.5 text-[11px] text-slate-400">
                      {p.timeframe}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SignalBadge signal={p.overall_signal} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-[#1a2d4a] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan-500"
                          style={{ width: `${p.confidence_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{p.confidence_score}%</span>
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-slate-400 font-mono">
                    ${p.current_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500 text-xs">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[#1e3050] p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[#1e3050] p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
