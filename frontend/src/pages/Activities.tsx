import { useEffect, useState } from 'react'
import { api, Activity } from '../api/client'
import { ActivityRow, ActivityHeader } from '../components/ActivityRow'

export function Activities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const LIMIT = 20

  async function load(o: number) {
    setLoading(true)
    try {
      const data = await api.get<Activity[]>(`/activities?limit=${LIMIT}&offset=${o}`)
      if (o === 0) setActivities(data)
      else setActivities((prev) => [...prev, ...data])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0) }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Activities</h1>

      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <ActivityHeader />
        {activities.length === 0 && !loading && (
          <p className="text-center text-slate-500 py-10">
            No activities yet. Sync with Strava to get started.
          </p>
        )}
        {activities.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
        {activities.length > 0 && activities.length % LIMIT === 0 && (
          <div className="p-4 text-center">
            <button
              onClick={() => {
                const next = offset + LIMIT
                setOffset(next)
                load(next)
              }}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 rounded-lg text-sm text-slate-300 hover:bg-gray-600 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
