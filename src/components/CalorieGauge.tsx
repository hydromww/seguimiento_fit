// El medidor de calorías del día: cuánto te queda y cómo vas en cada macro.
// Si aún no tienes metas, muestra lo que llevas.
import type { Nutrients } from '../lib/db'
import { fmt } from '../lib/nutrition'

interface Props {
  consumed: Nutrients
  goal?: Nutrients
  note?: string // ej. "Día de entreno"
}

const MACROS = [
  { key: 'protein', label: 'Proteína', color: '#b9bcff' },
  { key: 'carbs', label: 'Carbos', color: '#ffd58f' },
  { key: 'fat', label: 'Grasa', color: '#ffb3b3' },
] as const

export function CalorieGauge({ consumed, goal, note }: Props) {
  const hasGoal = !!goal && goal.kcal > 0
  const left = hasGoal ? goal.kcal - consumed.kcal : 0
  const percent = hasGoal ? Math.min(100, (consumed.kcal / goal.kcal) * 100) : 0

  return (
    <section className="gauge" aria-label="Calorías de hoy">
      <div className="gauge-top">
        <div>
          <span className="gauge-label">{hasGoal ? (left >= 0 ? 'Te quedan' : 'Te pasaste') : 'Llevas'}</span>
          <span className="gauge-value">{fmt('kcal', hasGoal ? Math.abs(left) : consumed.kcal)} <small>kcal</small></span>
        </div>
        <span className="gauge-label gauge-right">
          {note && <span className="goal-tag">{note}</span>}
          {hasGoal ? `${fmt('kcal', consumed.kcal)} de ${fmt('kcal', goal.kcal)}` : 'Define tu meta en Metas'}
        </span>
      </div>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${percent}%` }} /></div>
      <div className="gauge-macros">
        {MACROS.map(({ key, label, color }) => (
          <div key={key}>
            <span className="gauge-label">{label}</span>
            <b>{fmt(key, consumed[key])}<small>{hasGoal ? ` / ${fmt(key, goal[key])}` : ''} g</small></b>
            {hasGoal && (
              <div className="mini-track"><div style={{ width: `${Math.min(100, (consumed[key] / goal[key]) * 100)}%`, background: color }} /></div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
