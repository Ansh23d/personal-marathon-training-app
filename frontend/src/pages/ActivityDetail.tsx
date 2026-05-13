import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Heart, Zap, TrendingUp, Clock, MapPin, Flame } from 'lucide-react'
import { api, ActivityDetail as ActivityDetailType } from '../api/client'
import { RouteMap } from '../components/RouteMap'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function formatPace(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatTime(s: number | null): string {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatSpeed(ms: number | null): string {
  if (!ms) return '—'
  return `${(ms * 3.6).toFixed(1)} km/h`
}

interface StatTileProps {
  label: string
  value: string
  icon: React.ReactNode
  sub?: string
}

function StatTile({ label, value, icon, sub }: StatTileProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-start gap-3">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<ActivityDetailType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get<ActivityDetailType>(`/activities/${id}`)
      .then(setActivity)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading activity…
      </div>
    )
  }

  if (!activity) {
    return <div className="text-slate-500 py-10 text-center">Activity not found.</div>
  }

  const elevationData = activity.splits.map((s) => ({
    km: `${s.split} km`,
    elevation: s.elevation_diff ?? 0,
    pace: s.pace_s ? Math.round(s.pace_s) : null,
    hr: s.average_heartrate,
  }))

  const hasSplits = activity.splits.length > 0
  const hasMap = !!activity.map_polyline

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{activity.name}</h1>
          <p className="text-sm text-slate-400">
            {new Date(activity.date).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
            {activity.sport_type && activity.sport_type !== 'Run' && (
              <span className="ml-2 text-slate-500">· {activity.sport_type.replace(/([A-Z])/g, ' $1').trim()}</span>
            )}
          </p>
        </div>
        <a
          href={activity.strava_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-strava text-white rounded-lg text-sm hover:opacity-90 shrink-0"
        >
          <ExternalLink size={13} />
          View on Strava
        </a>
      </div>

      {/* Description */}
      {activity.description && (
        <p className="text-sm text-slate-400 bg-gray-900 rounded-xl px-4 py-3">
          {activity.description}
        </p>
      )}

      {/* Map */}
      {hasMap ? (
        <RouteMap polyline={activity.map_polyline!} />
      ) : (
        <div className="w-full h-48 rounded-xl bg-gray-900 flex flex-col items-center justify-center gap-2 text-slate-500">
          <MapPin size={24} className="opacity-40" />
          <p className="text-sm">No GPS route available for this activity</p>
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Distance"
          value={`${activity.distance_km} km`}
          icon={<MapPin size={16} />}
        />
        <StatTile
          label="Moving Time"
          value={formatTime(activity.moving_time_s)}
          icon={<Clock size={16} />}
          sub={activity.elapsed_time_s ? `Total: ${formatTime(activity.elapsed_time_s)}` : undefined}
        />
        <StatTile
          label="Average Pace"
          value={`${formatPace(activity.pace_per_km)}/km`}
          icon={<TrendingUp size={16} />}
        />
        <StatTile
          label="Elevation Gain"
          value={`${Math.round(activity.total_elevation_gain ?? 0)} m`}
          icon={<TrendingUp size={16} />}
          sub={activity.elev_high != null && activity.elev_low != null
            ? `${Math.round(activity.elev_low)}–${Math.round(activity.elev_high)} m`
            : undefined}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {activity.average_heartrate && (
          <StatTile
            label="Avg Heart Rate"
            value={`${Math.round(activity.average_heartrate)} bpm`}
            icon={<Heart size={16} />}
            sub={activity.max_heartrate ? `Max: ${Math.round(activity.max_heartrate)} bpm` : undefined}
          />
        )}
        {activity.average_cadence && (
          <StatTile
            label="Avg Cadence"
            value={`${Math.round(activity.average_cadence * 2)} spm`}
            icon={<Zap size={16} />}
            sub="steps per minute"
          />
        )}
        {activity.calories && (
          <StatTile
            label="Calories"
            value={`${activity.calories} kcal`}
            icon={<Flame size={16} />}
          />
        )}
        {activity.relative_effort && (
          <StatTile
            label="Relative Effort"
            value={`${activity.relative_effort.toFixed(0)}`}
            icon={<Zap size={16} />}
          />
        )}
        {activity.fitness_score && (
          <StatTile
            label="Fitness Score"
            value={`${activity.fitness_score.toFixed(1)}`}
            icon={<TrendingUp size={16} />}
            sub="from this effort"
          />
        )}
      </div>

      {/* Per-km splits */}
      {hasSplits && (
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-white">Splits</h2>
          </div>

          {/* Pace chart */}
          {elevationData.some(d => d.pace) && (
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={elevationData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="km" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={(v) => formatPace(v)}
                    reversed
                  />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(v: number) => [formatPace(v) + '/km', 'Pace']}
                  />
                  <Area
                    type="monotone" dataKey="pace" name="Pace"
                    stroke="#FC4C02" fill="#FC4C02" fillOpacity={0.15} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Splits table */}
          <div>
            <div className="grid grid-cols-5 px-4 py-2 bg-gray-800/50 text-xs text-slate-500 uppercase tracking-wider border-b border-gray-700">
              <span>Split</span>
              <span className="text-right">Distance</span>
              <span className="text-right">Time</span>
              <span className="text-right">Pace</span>
              <span className="text-right">Elev</span>
            </div>
            {activity.splits.map((s, i) => {
              const isLast = i === activity.splits.length - 1
              const isFastest = s.pace_s === Math.min(...activity.splits.map(x => x.pace_s ?? Infinity))
              return (
                <div
                  key={s.split}
                  className={`grid grid-cols-5 px-4 py-2.5 text-sm border-b border-gray-700 ${
                    isFastest ? 'bg-orange-950/30' : ''
                  }`}
                >
                  <span className="text-slate-400">
                    {isLast && s.distance_km < 0.95 ? `${(s.distance_km * 1000).toFixed(0)} m` : `${s.split} km`}
                  </span>
                  <span className="text-right text-slate-300">{s.distance_km} km</span>
                  <span className="text-right text-slate-300">{formatTime(s.moving_time_s)}</span>
                  <span className={`text-right font-medium ${isFastest ? 'text-strava' : 'text-white'}`}>
                    {formatPace(s.pace_s)}/km
                  </span>
                  <span className="text-right text-slate-400">
                    {s.elevation_diff != null
                      ? `${s.elevation_diff > 0 ? '+' : ''}${Math.round(s.elevation_diff)} m`
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
