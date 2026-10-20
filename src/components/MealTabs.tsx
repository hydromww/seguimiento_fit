// Selector de comida (Desayuno, Almuerzo, Cena, Snacks) en forma de pestañas.
import type { Meal } from '../lib/db'
import { MEALS } from '../lib/diary'

export function MealTabs({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <div className="segmented" role="tablist" aria-label="Comida">
      {MEALS.map((m) => (
        <button key={m.id} role="tab" aria-selected={m.id === value} className={m.id === value ? 'on' : ''} onClick={() => onChange(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  )
}
