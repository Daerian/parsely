import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload as UploadIcon,
  Receipt,
  PiggyBank,
  TrendingUp,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Activity', icon: Receipt },
  { to: '/upload', label: 'Upload', icon: UploadIcon },
  { to: '/budgets', label: 'Budget', icon: PiggyBank },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp },
  { to: '/analytics', label: 'Insights', icon: BarChart3 },
]

export default function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-stone-50">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <span className="text-sm font-bold text-brand-700">🌿 Parsely</span>
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            `rounded-full p-1.5 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-400 active:bg-stone-100'}`
          }
        >
          <SettingsIcon size={20} strokeWidth={2} />
        </NavLink>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl justify-between px-1">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                  isActive ? 'text-brand-700' : 'text-stone-400'
                }`
              }
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
