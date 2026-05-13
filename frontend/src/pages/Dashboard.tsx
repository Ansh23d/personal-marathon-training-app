import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, DashboardData, PMCPoint, ThisWeek, Activity } from '../api/client'
import { StatCard } from '../components/StatCard'
import { PMCChart } from '../components/PMCChart'
import { WeekCalendar } from '../components/WeekCalendar'
import { RefreshCw, ArrowRight } from 'lucide-react'

function formatPace(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function freshnessColor(freshness: number): string {
  if (freshness > 10) return 'text-green-400'
  if (freshness > -10) return 'text-yellow-400'
  return 'text-red-400'
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [pmc, setPmc] = useState<PMCPoint[]>([])
  const [week, setWeek] = useState<ThisWeek | null>(null)
  const [latestRun, setLatestRun] = useState<Activity | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    const [d, p, w, runs] = await Promise.all([
      api.get<DashboardData>('/dashboard'),
      api.get<PMCPoint[]>('/fitness/pmc?days=90'),
      api.get<ThisWeek>('/plan/this-week'),
      api.get<Activity[]>('/activities?limit=1'),
    ])
    setData(d)
    setPmc(p)
    setWeek(w && 'workouts' in w && w.workouts.length > 0 ? w : null)
    setLatestRun(runs[0] ?? null)
  }

  async function sync() {
    setSyncing(true)
    try {
      await api.post('/sync')
      await load()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading...
      </div>
    )
  }

  const topPredictions = ['5K', '10K', 'half_marathon', 'marathon']
    .filter((k) => data.race_predictions[k])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 bg-strava text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Strava'}
        </button>
      </div>

      {/* Fitness stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Fitness" value={data.fitness} sub="Long-term training load" color="text-blue-400" />
        <StatCard label="Fatigue" value={data.fatigue} sub="Recent training load" color="text-red-400" />
        <StatCard label="Freshness" value={data.freshness} sub="Fitness minus fatigue" color={freshnessColor(data.freshness)} />
        <StatCard label="Fitness Score" value={data.fitness_score || '—'} sub="Based on recent efforts" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="This Week" value={`${data.weekly_km} km`} />
        <StatCard label="Last 30 Days" value={`${data.monthly_km} km`} />
      </div>

      {/* PMC Chart */}
      {pmc.length > 0 && <PMCChart data={pmc} />}

      {/* Latest Run */}
      {latestRun && (
        <div className="bg-gray-900 rounded-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
            <h2 className="text-sm text-slate-400 uppercase tracking-wider">Latest Run</h2>
            <Link to="/activities" className="text-xs text-strava hover:underline flex items-center gap-1">
              All runs <ArrowRight size={11} />
            </Link>
          </div>
          <Link to={`/activities/${latestRun.id}`} className="grid grid-cols-6 items-center px-5 py-4 hover:bg-gray-800/50 transition-colors rounded-b-xl">
            <div className="col-span-2 min-w-0 pr-4">
              <p className="font-semibold text-white truncate">{latestRun.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{new Date(latestRun.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-0.5">Distance</p>
              <p className="text-lg font-bold text-white">{latestRun.distance_km}</p>
              <p className="text-xs text-slate-500">km</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-0.5">Time</p>
              <p className="text-lg font-bold text-white">{formatTime(latestRun.moving_time_s)}</p>
              <p className="text-xs text-slate-500">moving</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-0.5">Pace</p>
              <p className="text-lg font-bold text-white">{formatPace(latestRun.pace_per_km)}</p>
              <p className="text-xs text-slate-500">/km</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-0.5">Elevation</p>
              <p className="text-lg font-bold text-white">{Math.round(latestRun.total_elevation_gain ?? 0)}</p>
              <p className="text-xs text-slate-500">m gain</p>
            </div>
          </Link>
        </div>
      )}

      {/* Race Predictions */}
      {topPredictions.length > 0 && (
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700">
            <h2 className="text-sm text-slate-400 uppercase tracking-wider">Race Predictions</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {topPredictions.map((key) => {
                const pred = data.race_predictions[key]
                const label = key === 'half_marathon' ? 'Half Marathon' : key.toUpperCase()
                return (
                  <div key={key} className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="text-lg font-bold text-white">{pred.time_formatted}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* This week's plan */}
      {week ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm text-slate-400 uppercase tracking-wider">This Week's Training</h2>
            <Link to="/plan" className="text-xs text-strava hover:underline">Full plan →</Link>
          </div>
          <WeekCalendar
            workouts={week.workouts}
            targetKm={week.target_weekly_km}
            phase={week.phase}
            weekNumber={week.week_number}
          />
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <p className="text-slate-400 mb-3">No active training plan.</p>
          <Link
            to="/plan"
            className="inline-block px-4 py-2 bg-strava text-white rounded-lg text-sm hover:opacity-90"
          >
            Create a plan
          </Link>
        </div>
      )}
    </div>
  )
}
