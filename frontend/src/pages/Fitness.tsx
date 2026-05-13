import { useEffect, useState } from 'react'
import { api, PMCPoint, PaceZones } from '../api/client'
import { PMCChart } from '../components/PMCChart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ZONE_COLORS: Record<string, string> = {
  'Easy':       'bg-green-500',
  'Moderate':   'bg-blue-500',
  'Tempo':      'bg-orange-500',
  'Threshold':  'bg-red-500',
  'VO2 Max':    'bg-purple-500',
}

const ZONE_DESCRIPTIONS: Record<string, string> = {
  'Easy':       'Warm-up, cool-down, recovery runs — fully conversational',
  'Moderate':   'Long run effort, comfortable sustained pace',
  'Tempo':      'Comfortably hard, sustainable for about an hour',
  'Threshold':  'Hard effort, sustainable for 20–30 minutes',
  'VO2 Max':    'Very hard, short fast reps to build top-end speed',
}

type DayEffort = { date: string; relative_effort: number }

export function Fitness() {
  const [pmc, setPmc] = useState<PMCPoint[]>([])
  const [zones, setZones] = useState<PaceZones | null>(null)
  const [pmcDays, setPmcDays] = useState(90)
  const [effortData, setEffortData] = useState<DayEffort[]>([])

  async function load(days: number) {
    const [p, z] = await Promise.all([
      api.get<PMCPoint[]>(`/fitness/pmc?days=${days}`),
      api.get<PaceZones | { error: string }>('/fitness/zones'),
    ])
    setPmc(p)
    if (!('error' in z)) setZones(z)

    // Build weekly relative effort bars from PMC data
    const weekly: Record<string, number> = {}
    for (const pt of p) {
      const d = new Date(pt.date)
      const mon = new Date(d)
      mon.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
      const key = mon.toISOString().slice(0, 10)
      weekly[key] = (weekly[key] ?? 0) + pt.relative_effort
    }
    setEffortData(
      Object.entries(weekly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, relative_effort]) => ({ date, relative_effort: Math.round(relative_effort) }))
    )
  }

  useEffect(() => { load(pmcDays) }, [pmcDays])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Fitness Analytics</h1>

      {/* PMC toggle */}
      <div className="flex items-center gap-2">
        {[30, 90, 180, 365].map((d) => (
          <button
            key={d}
            onClick={() => setPmcDays(d)}
            className={`px-3 py-1 rounded-lg text-sm ${
              pmcDays === d ? 'bg-strava text-white' : 'bg-gray-800 text-slate-400 hover:bg-gray-700'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {pmc.length > 0 ? <PMCChart data={pmc} /> : (
        <div className="bg-gray-900 rounded-xl p-8 text-center text-slate-500">
          Sync activities to see your Fitness &amp; Freshness chart
        </div>
      )}

      {/* Weekly Relative Effort bars */}
      {effortData.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-4">Weekly Relative Effort</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={effortData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={(d) => {
                  const dt = new Date(d)
                  return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()}`
                }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(val: number) => [val, 'Relative Effort']}
              />
              <Bar dataKey="relative_effort" name="Relative Effort" fill="#FC4C02" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pace Zones */}
      {zones ? (
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-slate-400 uppercase tracking-wider">Training Zones</h2>
            <span className="text-xs text-slate-500">Fitness Score {zones.fitness_score}</span>
          </div>
          <div className="space-y-3">
            {Object.entries(zones.zones).map(([name, z], i) => (
              <div key={name} className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${ZONE_COLORS[name] ?? 'bg-gray-500'}`} />
                <div className="w-24 text-sm font-medium">
                  <span className="text-slate-500 text-xs mr-1">Z{i + 1}</span>{name}
                </div>
                <div className="text-sm font-mono text-white">{z.max_pace} – {z.min_pace}/km</div>
                <div className="text-xs text-slate-500 hidden sm:block">{ZONE_DESCRIPTIONS[name]}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4">
            Zones calculated from your Fitness Score and update automatically as your fitness improves
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 text-center text-slate-500 text-sm">
          Sync activities to calculate your training zones
        </div>
      )}
    </div>
  )
}
