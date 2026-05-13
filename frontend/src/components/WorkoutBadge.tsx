const COLORS: Record<string, string> = {
  easy:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  tempo:      'bg-orange-500/15 text-orange-400 border-orange-500/20',
  intervals:  'bg-red-500/15 text-red-400 border-red-500/20',
  long:       'bg-sky-500/15 text-sky-400 border-sky-500/20',
  race_pace:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  race:       'bg-strava text-white border-strava',
  rest:       'bg-slate-800/50 text-slate-500 border-slate-700/50',
  strides:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
}

const LABELS: Record<string, string> = {
  easy: 'Easy', tempo: 'Tempo', intervals: 'Intervals',
  long: 'Long Run', race_pace: 'Race Pace', race: 'RACE',
  rest: 'Rest', strides: 'Strides',
}

export function WorkoutBadge({ type }: { type: string }) {
  const cls = COLORS[type] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/50'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {LABELS[type] ?? type}
    </span>
  )
}
