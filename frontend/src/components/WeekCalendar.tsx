import { WorkoutBadge } from './WorkoutBadge'
import { Workout } from '../api/client'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  workouts: Workout[]
  targetKm: number
  phase: string
  weekNumber: number
}

export function WeekCalendar({ workouts, targetKm, phase, weekNumber }: Props) {
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Week {weekNumber}</span>
          <span className="text-xs text-slate-500 capitalize bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">{phase}</span>
        </div>
        <span className="text-xs text-slate-400 font-medium">{targetKm} km target</span>
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-700">
        {DAYS.map((day, i) => {
          const workout = workouts.find((w) => w.day_of_week === i)
          const isToday = i === todayIdx
          return (
            <div key={day} className={`p-3 min-h-[110px] flex flex-col gap-1.5 ${isToday ? 'bg-strava/5' : ''}`}>
              <p className={`text-xs font-semibold ${isToday ? 'text-strava' : 'text-slate-500'}`}>{day}</p>
              {workout && workout.type !== 'rest' ? (
                <>
                  <WorkoutBadge type={workout.type} />
                  <p className="text-xs text-slate-400 leading-tight mt-0.5">{workout.description}</p>
                  {workout.target_distance_km > 0 && (
                    <p className="text-xs text-slate-500 font-medium">{workout.target_distance_km} km</p>
                  )}
                  {workout.pace_range && (
                    <p className="text-xs text-slate-600">{workout.pace_range}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-700">Rest</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
