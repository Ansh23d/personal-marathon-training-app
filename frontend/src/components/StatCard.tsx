interface Props {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function StatCard({ label, value, sub, color = 'text-white' }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <p className="section-label mb-2">{label}</p>
      <p className={`metric-value ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5 font-medium">{sub}</p>}
    </div>
  )
}
