// La barra de colores que muestra de dónde vienen las calorías de un alimento.
// Cada gramo de proteína o carbohidrato aporta 4 kcal, y cada gramo de grasa 9 kcal.
import type { Nutrients } from '../lib/db'

export function MacroBar({ n }: { n: Nutrients }) {
  const p = n.protein * 4
  const c = n.carbs * 4
  const g = n.fat * 9
  const total = p + c + g
  if (total === 0) return <div className="macro-bar empty" />
  return (
    <div className="macro-bar" aria-hidden="true">
      <div className="protein" style={{ width: `${(p / total) * 100}%` }} />
      <div className="carbs" style={{ width: `${(c / total) * 100}%` }} />
      <div className="fat" style={{ width: `${(g / total) * 100}%` }} />
    </div>
  )
}
