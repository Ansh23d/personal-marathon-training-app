const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}

// --- Types ---

export interface AuthStatus {
  connected: boolean
  athlete_name?: string
  athlete_photo?: string
}

export interface DashboardData {
  fitness: number
  fatigue: number
  freshness: number
  weekly_km: number
  monthly_km: number
  fitness_score: number
  race_predictions: Record<string, { time_s: number; time_formatted: string }>
}

export interface PMCPoint {
  date: string
  fitness: number
  fatigue: number
  freshness: number
  relative_effort: number
}

export interface Activity {
  id: number
  strava_id: number
  name: string
  sport_type: string
  date: string
  distance_km: number
  moving_time_s: number
  pace_per_km: number | null
  average_heartrate: number | null
  relative_effort: number | null
  fitness_score: number | null
  total_elevation_gain: number | null
}

export interface Workout {
  type: string
  description: string
  target_distance_km: number
  pace_range?: string
  date: string
  day_of_week: number
  status?: string
}

export interface PlanWeek {
  week_number: number
  phase: string
  start_date: string
  target_weekly_km: number
  workouts: Workout[]
}

export interface CurrentPlan {
  race_type: string
  race_date: string | null
  goal_time_s: number | null
  weeks: PlanWeek[]
}

export interface ThisWeek {
  week_number: number
  phase: string
  target_weekly_km: number
  workouts: Workout[]
}

export interface Split {
  split: number
  distance_km: number
  moving_time_s: number
  pace_s: number | null
  elevation_diff: number | null
  average_heartrate: number | null
  average_speed: number | null
}

export interface ActivityDetail extends Activity {
  elapsed_time_s: number | null
  max_speed: number | null
  max_heartrate: number | null
  average_cadence: number | null
  calories: number | null
  elev_high: number | null
  elev_low: number | null
  description: string | null
  map_polyline: string | null
  start_latlng: [number, number] | null
  splits: Split[]
  strava_url: string
}

export interface PaceZones {
  fitness_score: number
  zones: Record<string, {
    min_pace: string
    max_pace: string
    min_s: number
    max_s: number
  }>
}
