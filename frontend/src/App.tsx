import { useEffect, useState, Suspense, lazy } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Activity, Target, TrendingUp, Menu, X } from 'lucide-react'
import { api, AuthStatus } from './api/client'
import { Dashboard } from './pages/Dashboard'
import { Activities } from './pages/Activities'
import { Plan } from './pages/Plan'
import { Fitness } from './pages/Fitness'
import { Connect } from './pages/Connect'

const ActivityDetail = lazy(() => import('./pages/ActivityDetail').then(m => ({ default: m.ActivityDetail })))

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/fitness', label: 'Fitness', icon: TrendingUp },
  { to: '/plan', label: 'Plan', icon: Target },
  { to: '/activities', label: 'Activities', icon: Activity },
]

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-strava/15 text-strava border border-strava/20'
            : 'text-slate-400 hover:text-slate-100 hover:bg-gray-800 border border-transparent'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setMobileOpen(false) }, [location])
  useEffect(() => {
    api.get<AuthStatus>('/auth/status').then(setAuth).catch(() => setAuth({ connected: false }))
  }, [])

  if (!auth) return <div className="min-h-screen bg-gray-950" />
  if (!auth.connected) return <Connect />

  return (
    <div className="h-screen bg-gray-950 flex overflow-hidden">

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60
        bg-gray-900 border-r border-gray-700
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:inset-auto lg:translate-x-0 lg:flex lg:flex-col lg:h-full lg:shrink-0
      `}
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-strava flex items-center justify-center text-base">🏃</div>
          <div>
            <p className="font-bold text-sm text-white leading-tight">Pace Lab</p>
            <p className="text-xs text-slate-500 leading-tight">by Strava</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 pt-4">
          {NAV.map((n) => <NavItem key={n.to} {...n} />)}
        </nav>

        {/* Athlete */}
        {auth.athlete_name && (
          <div className="p-4 border-t border-gray-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-strava/80 overflow-hidden ring-2 ring-strava/30 shrink-0 flex items-center justify-center">
              {auth.athlete_photo?.startsWith('http')
                ? <img src={auth.athlete_photo} alt="" className="w-full h-full object-cover" />
                : <span className="text-sm font-bold text-white">{auth.athlete_name?.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{auth.athlete_name}</p>
              <p className="text-xs text-slate-500">Athlete</p>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-gray-700 flex items-center px-4 lg:hidden bg-gray-900 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="ml-3 font-bold text-white">Pace Lab</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-5xl mx-auto w-full">
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/fitness"       element={<Fitness />} />
              <Route path="/plan"          element={<Plan />} />
              <Route path="/activities"    element={<Activities />} />
              <Route path="/activities/:id" element={
                <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-500">Loading activity…</div>}>
                  <ActivityDetail />
                </Suspense>
              } />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
