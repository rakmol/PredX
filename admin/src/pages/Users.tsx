import { useEffect, useState, useCallback } from 'react'
import { Search, Crown, Trash2, ChevronLeft, ChevronRight, AlertCircle, Loader } from 'lucide-react'
import { api, type User } from '../lib/api'

function TierBadge({ tier }: { tier: 'free' | 'pro' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        tier === 'pro'
          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border border-slate-600/30 bg-slate-700/20 text-slate-400'
      }`}
    >
      {tier === 'pro' && <Crown size={9} />}
      {tier.toUpperCase()}
    </span>
  )
}

function Avatar({ user }: { user: User }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full border border-white/10 object-cover" />
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1a2d4a] bg-[#0d1829] text-xs font-semibold text-slate-400">
      {(user.email?.[0] ?? '?').toUpperCase()}
    </div>
  )
}

export default function Users() {
  const [data, setData] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const load = useCallback(() => {
    setLoading(true)
    api.users.list(page, LIMIT, search)
      .then((r) => { setData(r.data); setTotal(r.total) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  async function toggleTier(user: User) {
    const next = user.subscription_tier === 'pro' ? 'free' : 'pro'
    setActionId(user.id)
    try {
      const updated = await api.users.setTier(user.id, next)
      setData((prev) => prev.map((u) => (u.id === user.id ? updated : u)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update tier')
    } finally {
      setActionId(null)
    }
  }

  async function deleteUser(user: User) {
    setConfirmDelete(null)
    setActionId(user.id)
    try {
      await api.users.delete(user.id)
      setData((prev) => prev.filter((u) => u.id !== user.id))
      setTotal((t) => t - 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete user')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Users</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} registered accounts</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full rounded-lg border border-[#1e3050] bg-[#0d1829] pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
        />
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
          <div className="p-8 text-center text-sm text-slate-500">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2d4a] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tier</th>
                <th className="hidden md:table-cell px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user.id} className="border-b border-[#1a2d4a]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{user.email}</p>
                        {user.username && (
                          <p className="truncate text-xs text-slate-500">@{user.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={user.subscription_tier} />
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleTier(user)}
                        disabled={actionId === user.id}
                        className="rounded-lg border border-[#1e3050] px-2.5 py-1.5 text-xs text-slate-400 hover:border-amber-500/30 hover:text-amber-400 transition-all disabled:opacity-40"
                        title={`Switch to ${user.subscription_tier === 'pro' ? 'free' : 'pro'}`}
                      >
                        {actionId === user.id ? (
                          <Loader size={12} className="animate-spin" />
                        ) : (
                          user.subscription_tier === 'pro' ? 'Set Free' : 'Set Pro'
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(user)}
                        disabled={actionId === user.id}
                        className="rounded-lg border border-[#1e3050] p-1.5 text-slate-500 hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-40"
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
          <p className="text-slate-500 text-xs">
            Page {page} of {totalPages} · {total.toLocaleString()} users
          </p>
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-6 space-y-4">
            <div>
              <p className="font-semibold text-slate-100">Delete user?</p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="text-slate-200">{confirmDelete.email}</span> will be permanently deleted.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-[#1e3050] py-2 text-sm text-slate-400 hover:text-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="flex-1 rounded-lg bg-red-500/20 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
