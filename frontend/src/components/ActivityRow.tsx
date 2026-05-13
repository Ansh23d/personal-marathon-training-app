import { Link } from 'react-router-dom'
import { Activity } from '../api/client'

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

export function ActivityRow({ activity: a }: { activity: Activity }) {
  return (
    <Link
      to={`/activities/${a.id}`}
      className="grid grid-cols-7 gap-2 px-4 py-3.5 hover:bg-gray-800/60 transition-colors text-sm border-b border-gray-700 cursor-pointer group"
    >
      <div className="col-span-2">
        <p className="font-medium text-slate-200 truncate group-hover:text-white transition-colors">{a.name}</p>
        <p className="text-xs text-slate-600 mt-0.5">{a.date}</p>
      </div>
      <div className="text-right self-center">
        <p className="text-slate-300 font-medium">{a.distance_km} km</p>
      </div>
      <div className="text-right self-center">
        <p className="text-slate-300 font-medium">{formatTime(a.moving_time_s)}</p>
      </div>
      <div className="text-right self-center">
        <p className="text-slate-300 font-medium">{formatPace(a.pace_per_km)}/km</p>
      </div>
      <div className="text-right self-center">
        <p className="text-slate-300">{a.relative_effort?.toFixed(0) ?? '—'}</p>
      </div>
      <div className="text-right self-center">
        <p className={`font-semibold ${a.fitness_score && a.fitness_score > 40 ? 'text-emerald-400' : 'text-slate-400'}`}>
          {a.fitness_score?.toFixed(1) ?? '—'}
        </p>
      </div>
    </Link>
  )
}

export function ActivityHeader() {
  const cols = ['Activity', 'Distance', 'Time', 'Pace', 'Relative Effort', 'Fitness Score']
  return (
    <div className="grid grid-cols-7 gap-2 px-4 py-2.5 bg-gray-800/50 text-xs text-slate-500 uppercase tracking-widest border-b border-gray-700 font-semibold">
      {cols.map((c) => (
        <div key={c} className={c === 'Activity' ? 'col-span-2' : 'text-right'}>{c}</div>
      ))}
    </div>
  )
}
