import { useEffect, useState } from 'react'
import { api, CurrentPlan, PlanWeek } from '../api/client'
import { WeekCalendar } from '../components/WeekCalendar'

const RACE_TYPES = [
  { value: '5K', label: '5K', weeks: 8 },
  { value: '10K', label: '10K', weeks: 10 },
  { value: 'half_marathon', label: 'Half Marathon', weeks: 12 },
  { value: 'marathon', label: 'Marathon', weeks: 18 },
]

const PHASE_COLORS: Record<string, string> = {
  base: 'bg-blue-900 text-blue-300',
  build: 'bg-orange-900 text-orange-300',
  peak: 'bg-red-900 text-red-300',
  taper: 'bg-green-900 text-green-300',
}

function formatGoalTime(s: number | null): string {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function parseGoalTime(str: string): number | null {
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function Plan() {
  const [plan, setPlan] = useState<CurrentPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  // Form state
  const [raceType, setRaceType] = useState('marathon')
  const [raceDate, setRaceDate] = useState('')
  const [goalTime, setGoalTime] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<{ plan: CurrentPlan | null } | CurrentPlan>('/plan/current')
      if ('plan' in data && data.plan === null) {
        setPlan(null)
        setShowForm(true)
      } else {
        setPlan(data as CurrentPlan)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setError('')
    setCreating(true)
    try {
      const body: Record<string, unknown> = { race_type: raceType }
      if (raceDate) body.race_date = raceDate
      if (goalTime) {
        const s = parseGoalTime(goalTime)
        if (!s) { setError('Invalid goal time. Use H:MM:SS or M:SS'); setCreating(false); return }
        body.goal_time_s = s
      }
      await api.post('/plan/create', body)
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create plan')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="text-slate-500 py-10 text-center">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Training Plan</h1>
        {plan && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-gray-700 rounded-lg hover:bg-gray-600 text-slate-200"
          >
            New goal
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Set your race goal</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {RACE_TYPES.map((rt) => (
              <button
                key={rt.value}
                onClick={() => setRaceType(rt.value)}
                className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                  raceType === rt.value
                    ? 'bg-strava border-strava text-white'
                    : 'border-gray-700 text-slate-400 hover:border-gray-600'
                }`}
              >
                {rt.label}
                <br />
                <span className="text-xs opacity-70">{rt.weeks} weeks</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Race Date (optional)</label>
              <input
                type="date"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Goal Time (optional, e.g. 3:30:00)</label>
              <input
                type="text"
                placeholder="H:MM:SS or M:SS"
                value={goalTime}
                onChange={(e) => setGoalTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={create}
              disabled={creating}
              className="px-5 py-2 bg-strava text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Generating…' : 'Generate Plan'}
            </button>
            {plan && (
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg text-sm text-slate-300 hover:bg-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan overview */}
      {plan && !showForm && (
        <>
          <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl">
            <div>
              <p className="text-xs text-slate-500">Race</p>
              <p className="font-semibold capitalize">{plan.race_type.replace('_', ' ')}</p>
            </div>
            {plan.race_date && (
              <div>
                <p className="text-xs text-slate-500">Race Date</p>
                <p className="font-semibold">{plan.race_date}</p>
              </div>
            )}
            {plan.goal_time_s && (
              <div>
                <p className="text-xs text-slate-500">Goal Time</p>
                <p className="font-semibold">{formatGoalTime(plan.goal_time_s)}</p>
              </div>
            )}
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-500">Total Weeks</p>
              <p className="font-semibold">{plan.weeks.length}</p>
            </div>
          </div>

          {/* Phase overview */}
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Plan Structure</p>
            <div className="flex gap-1 h-6 rounded overflow-hidden">
              {plan.weeks.map((w) => (
                <div
                  key={w.week_number}
                  title={`Week ${w.week_number}: ${w.phase}`}
                  className={`flex-1 ${PHASE_COLORS[w.phase]?.split(' ')[0] ?? 'bg-gray-700'} cursor-pointer hover:opacity-80`}
                  onClick={() => setExpandedWeek(w.week_number === expandedWeek ? null : w.week_number)}
                />
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              {Object.entries(PHASE_COLORS).map(([phase, cls]) => (
                <span key={phase} className={`px-2 py-0.5 rounded ${cls}`}>{phase}</span>
              ))}
            </div>
          </div>

          {/* Week list */}
          <div className="space-y-3">
            {plan.weeks.map((w: PlanWeek) => (
              <div key={w.week_number}>
                <button
                  onClick={() => setExpandedWeek(w.week_number === expandedWeek ? null : w.week_number)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Week {w.week_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${PHASE_COLORS[w.phase] ?? 'bg-gray-700 text-slate-300'}`}>
                      {w.phase}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>{w.target_weekly_km} km</span>
                    <span className="text-slate-600">{w.start_date}</span>
                    <span>{expandedWeek === w.week_number ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expandedWeek === w.week_number && (
                  <div className="mt-1">
                    <WeekCalendar
                      workouts={w.workouts}
                      targetKm={w.target_weekly_km}
                      phase={w.phase}
                      weekNumber={w.week_number}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
