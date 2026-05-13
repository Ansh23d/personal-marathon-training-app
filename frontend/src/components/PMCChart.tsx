import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { PMCPoint } from '../api/client'

interface Props { data: PMCPoint[] }

export function PMCChart({ data }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <h2 className="section-label mb-4">Fitness &amp; Freshness</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={(d) => {
              const dt = new Date(d)
              return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()}`
            }}
            interval="preserveStartEnd"
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(val: number, name: string) => [val.toFixed(1), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#374151" />
          <Line type="monotone" dataKey="fitness"   name="Fitness"   stroke="#38bdf8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="fatigue"   name="Fatigue"   stroke="#f87171" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="freshness" name="Freshness" stroke="#34d399" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-3 text-xs text-slate-500">
        <span><span className="text-sky-400 font-medium">Fitness</span> — long-term training load</span>
        <span><span className="text-red-400 font-medium">Fatigue</span> — recent training load</span>
        <span><span className="text-emerald-400 font-medium">Freshness</span> — Fitness minus Fatigue</span>
      </div>
    </div>
  )
}
