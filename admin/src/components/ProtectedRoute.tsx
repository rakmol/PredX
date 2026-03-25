import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    const token = localStorage.getItem('predx_admin_token')
    if (!token) { setState('denied'); return }

    api.verify()
      .then(() => setState('ok'))
      .catch(() => { localStorage.removeItem('predx_admin_token'); setState('denied') })
  }, [])

  if (state === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  return state === 'ok' ? <>{children}</> : <Navigate to="/login" replace />
}
