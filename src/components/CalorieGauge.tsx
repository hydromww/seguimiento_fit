// El medidor de calorías del día que va arriba en la pantalla principal.
// Por ahora muestra ceros: se llenará cuando hagamos las metas (etapa 2)
// y el registro diario (etapa 3).
import type { Nutrients } from '../lib/db'
import { fmt } from '../lib/nutrition'

interface Props {
  consumed: Nutrients
  goal?: Nutrients // si aún no tienes meta, no se muestra
}

export function CalorieGauge({ consumed, goal }: Props) {
  const percent = goal && goal.kcal > 0 ? Math.min(100, (consumed.kcal / goal.kcal) * 100) : 0
  const macro = (key: 'protein' | 'carbs' | 'fat', letter: string) =>
    goal ? `${letter} ${fmt(key, consumed[key])} / ${fmt(key, goal[key])} g` : `${letter} ${fmt(key, consumed[key])} g`

  return (
    <section className="gauge" aria-label="Calorías de hoy">
      <div className="gauge-top">
        <span>Hoy llevas</span>
        <span>{goal ? `Meta ${fmt('kcal', goal.kcal)} kcal` : 'Sin meta todavía'}</span>
      </div>
      <span className="gauge-value">{fmt('kcal', consumed.kcal)} <small>kcal</small></span>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${percent}%` }} /></div>
      <div className="gauge-macros">
        <span>{macro('protein', 'P')}</span>
        <span>{macro('carbs', 'C')}</span>
        <span>{macro('fat', 'G')}</span>
      </div>
    </section>
  )
}
