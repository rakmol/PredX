import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader, Shield, Server, Database } from 'lucide-react'
import { api } from '../lib/api'

function StatusRow({ label, ok, loading }: { label: string; ok: boolean | null; loading: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1a2d4a]/50 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      {loading ? (
        <Loader size={15} className="animate-spin text-slate-500" />
      ) : ok ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle size={13} /> Online
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-red-400">
          <XCircle size={13} /> Offline
        </span>
      )}
    </div>
  )
}

export default function Settings() {
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [dbOk, setDbOk] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  const adminEmail = (() => {
    try {
      const token = localStorage.getItem('predx_admin_token') ?? ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.email as string
    } catch { return '—' }
  })()

  useEffect(() => {
    // Check API connectivity
    fetch('/admin/auth/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('predx_admin_token')}`,
        'Content-Type': 'application/json',
      },
    })
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false))

    // Check DB connectivity via stats endpoint
    api.stats()
      .then(() => setDbOk(true))
      .catch(() => setDbOk(false))
      .finally(() => setChecking(false))
  }, [])

  function handleChangePassword() {
    alert('To change the admin password, update ADMIN_PASSWORD in backend/.env and restart the server.')
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500">Admin panel configuration and system status</p>
      </div>

      {/* System Status */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Server size={15} className="text-cyan-400" />
          <p className="text-sm font-semibold text-slate-200">System Status</p>
        </div>
        <StatusRow label="Backend API (port 3001)" ok={apiOk} loading={checking} />
        <StatusRow label="Supabase Database" ok={dbOk} loading={checking} />
        <StatusRow label="Admin Panel (port 3002)" ok={true} loading={false} />
      </div>

      {/* Admin Account */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5 space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <Shield size={15} className="text-cyan-400" />
          <p className="text-sm font-semibold text-slate-200">Admin Account</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Email</span>
          <span className="text-sm text-slate-200">{adminEmail}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Role</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
            <Shield size={9} /> ADMIN
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Token expires</span>
          <span className="text-xs text-slate-400">24 hours from login</span>
        </div>

        <div className="pt-2 border-t border-[#1a2d4a]">
          <button
            onClick={handleChangePassword}
            className="rounded-lg border border-[#1e3050] px-3 py-2 text-xs text-slate-400 hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
          >
            How to change password…
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-2xl border border-[#1a2d4a] bg-[#080f1e] p-5 space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <Database size={15} className="text-cyan-400" />
          <p className="text-sm font-semibold text-slate-200">Configuration</p>
        </div>

        {[
          { key: 'Backend port', value: '3001' },
          { key: 'Admin panel port', value: '3002' },
          { key: 'Frontend port', value: '5173' },
          { key: 'Database', value: 'Supabase (PostgreSQL)' },
          { key: 'Auth provider', value: 'Supabase Auth' },
          { key: 'AI engine', value: 'Anthropic Claude' },
        ].map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{key}</span>
            <span className="font-mono text-xs text-slate-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
