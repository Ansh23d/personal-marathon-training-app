import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export function Connect() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (params.get('connected') === 'true') {
      navigate('/', { replace: true })
    }
  }, [params, navigate])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🏃</div>
        <h1 className="text-2xl font-bold">Marathon Pace Labligence</h1>
        <p className="text-slate-400">
          Connect your Strava account to sync activities and get your personalized training plan.
        </p>
        <a
          href="http://localhost:8000/auth/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-strava text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          Connect with Strava
        </a>
        <p className="text-xs text-slate-600">
          Only reads your activity data. No data is shared with third parties.
        </p>
      </div>
    </div>
  )
}
