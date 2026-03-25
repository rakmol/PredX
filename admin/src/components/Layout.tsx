import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Brain, Bell, Settings, LogOut, Shield,
} from 'lucide-react'

const nav = [
  { to: '/overview',    label: 'Overview',     icon: LayoutDashboard },
  { to: '/users',       label: 'Users',        icon: Users },
  { to: '/predictions', label: 'Predictions',  icon: Brain },
  { to: '/alerts',      label: 'Alerts',       icon: Bell },
  { to: '/settings',    label: 'Settings',     icon: Settings },
]

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('predx_admin_token')
    navigate('/login')
  }

  const email = (() => {
    try {
      const token = localStorage.getItem('predx_admin_token') ?? ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.email as string
    } catch { return 'Admin' }
  })()

  return (
    <div className="flex h-screen bg-[#060d1a] text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-[#1a2d4a] bg-[#080f1e]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1a2d4a]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
            <Shield size={16} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">PredX</p>
            <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest">Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3 pt-4">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1a2d4a] p-3">
          <div className="mb-2 rounded-lg bg-[#0d1829] px-3 py-2">
            <p className="text-[10px] text-slate-500">Logged in as</p>
            <p className="truncate text-xs font-medium text-slate-300">{email}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
