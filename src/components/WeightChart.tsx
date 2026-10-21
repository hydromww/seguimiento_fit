// Gráfica del peso: cada pesada es un punto, la tendencia es la línea gruesa y
// tu plan (si lo hay) es la línea punteada.
import type { TrendPoint } from '../lib/weight'
import { fromKey } from '../lib/dates'

interface Props {
  points: TrendPoint[]
  from: string // primer día que se muestra
  to: string // último día
  plan?: { date: string; kg: number; perWeek: number } // desde dónde arranca y cuánto por semana
  height?: number
  labels?: boolean
}

const W = 320

export function WeightChart({ points, from, to, plan, height = 150, labels = true }: Props) {
  const days = Math.max(1, (fromKey(to).getTime() - fromKey(from).getTime()) / 86400000)
  const shown = points.filter((p) => p.date >= from && p.date <= to)
  const planAt = (d: string) => plan && plan.kg + (plan.perWeek / 7) * ((fromKey(d).getTime() - fromKey(plan.date).getTime()) / 86400000)
  const planFrom = plan && (plan.date > from ? plan.date : from)
  const values = shown.flatMap((p) => [p.kg, p.trend])
  if (plan && planFrom) values.push(planAt(planFrom)!, planAt(to)!)
  if (!values.length) return <div className="weight-empty" style={{ height }}>Aún no hay pesadas en este periodo.</div>
  let lo = Math.min(...values), hi = Math.max(...values)
  const pad = Math.max(0.3, (hi - lo) * 0.15)
  lo -= pad; hi += pad
  const x = (d: string) => 8 + ((fromKey(d).getTime() - fromKey(from).getTime()) / 86400000 / days) * (W - 16 - (labels ? 22 : 0))
  const y = (kg: number) => height - 8 - ((kg - lo) / (hi - lo)) * (height - 16)
  // Líneas de guía cada 1 kg (o 0,5 si el rango es chico).
  const step = hi - lo > 4 ? 2 : hi - lo > 1.6 ? 1 : 0.5
  const grid: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v)
  const last = shown.at(-1)
  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label="Gráfica de tu peso">
      {labels && grid.map((v) => (
        <g key={v}>
          <line x1="0" x2={W} y1={y(v)} y2={y(v)} className="wc-grid" />
          <text x={W} y={y(v) - 3} textAnchor="end" className="wc-label">{String(Math.round(v * 10) / 10).replace('.', ',')}</text>
        </g>
      ))}
      {plan && planFrom && planFrom <= to && (
        <line x1={x(planFrom)} y1={y(planAt(planFrom)!)} x2={x(to)} y2={y(planAt(to)!)} className="wc-plan" />
      )}
      {shown.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r="3.2" className="wc-dot" />)}
      {shown.length > 1 && <polyline points={shown.map((p) => `${x(p.date)},${y(p.trend)}`).join(' ')} className="wc-trend" />}
      {last && <circle cx={x(last.date)} cy={y(last.trend)} r="5.5" className="wc-now" />}
    </svg>
  )
}
