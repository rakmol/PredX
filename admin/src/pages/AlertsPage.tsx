import { useEffect, useState, useCallback } from 'react'
import { Trash2, ChevronLeft, ChevronRight, AlertCircle, Loader } from 'lucide-react'
import { api, type Alert } from '../lib/api'

function StatusBadge({ alert }: { alert: Alert }) {
  if (alert.triggered_at) {
    return (
      <span className="inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
        TRIGGERED
      </span>
    )
  }
  return alert.is_active ? (
    <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
      ACTIVE
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-600/30 bg-slate-700/20 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      INACTIVE
    </span>
  )
}

export default function AlertsPage() {
  const [data, setData] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const load = useCallback(() => {
    setLoading(true)
    api.alerts.list(page, LIMIT, status)
      .then((r) => { setData(r.data); setTotal(r.total) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Delete this alert?')) return
    setDeletingId(id)
    try {
      await api.alerts.delete(id)
      setData((prev) => prev.filter((a) => a.id !== id))
      setTotal((t) => t - 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete alert')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Alerts</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} total price alerts</p>
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-lg border border-[#1e3050] bg-[#0d1829] px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-500/50 transition-all"
        >
          <option value="all">All alerts</option>
          <option value="active">Active only</option>
          <option value="triggered">Triggered only</option>
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
          <div className="p-8 text-center text-sm text-slate-500">No alerts found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2d4a] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Coin</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Condition</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Threshold</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="hidden lg:table-cell px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Triggered</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((alert) => (
                <tr key={alert.id} className="border-b border-[#1a2d4a]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{alert.coin_symbol.toUpperCase()}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{alert.user_id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#1e3050] bg-[#0d1829] px-2 py-0.5 text-[11px] text-slate-400">
                      {alert.condition.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {alert.threshold_currency === 'USD' ? '$' : '₵'}
                    {alert.display_threshold.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge alert={alert} />
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-slate-500">
                    {alert.triggered_at
                      ? new Date(alert.triggered_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deletingId === alert.id}
                      className="rounded-lg border border-[#1e3050] p-1.5 text-slate-500 hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-40"
                    >
                      {deletingId === alert.id
                        ? <Loader size={12} className="animate-spin" />
                        : <Trash2 size={13} />}
                    </button>
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
