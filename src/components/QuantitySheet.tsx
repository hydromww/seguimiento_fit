// Hoja que sube desde abajo para elegir cuánto comiste de un alimento.
// Sirve para agregar un registro nuevo y para corregir uno que ya existe.
import { useRef, useState } from 'react'
import type { Meal, Nutrients } from '../lib/db'
import { MEALS } from '../lib/diary'
import { fmt, forGrams } from '../lib/nutrition'
import { MealTabs } from './MealTabs'

interface Props {
  name: string
  per100g: Nutrients
  portionName: string
  portionGrams: number
  grams: number // cantidad con la que arranca
  meal: Meal
  dayKcal: number // lo que ya llevas hoy (sin contar este registro)
  goalKcal?: number
  editing?: boolean
  onConfirm: (grams: number, meal: Meal) => void
  onDelete?: () => void
  onClose: () => void
}

export function QuantitySheet(props: Props) {
  const { name, per100g, portionName, portionGrams, dayKcal, goalKcal, editing } = props
  const [text, setText] = useState(String(props.grams))
  const [meal, setMeal] = useState(props.meal)
  const input = useRef<HTMLInputElement>(null)
  const grams = Math.max(0, parseFloat(text.replace(',', '.')) || 0)
  const n = forGrams(per100g, grams)
  const hasPortion = portionGrams > 0 && portionGrams !== 100

  // Botones rápidos de cantidad.
  const chips = [
    ...(hasPortion ? [{ label: `${portionName} · ${fmt('kcal', portionGrams)} g`, grams: portionGrams }] : []),
    { label: '100 g', grams: 100 },
    ...(hasPortion ? [{ label: '½ porción', grams: Math.round(portionGrams / 2) }] : []),
  ]
  // Con − y + se sube o baja de a 10 g (de a 5 g en cantidades pequeñas).
  const step = (dir: 1 | -1) => {
    const size = grams < 50 ? 5 : 10
    setText(String(Math.max(0, Math.round((grams + dir * size) / size) * size)))
  }
  const portions = hasPortion ? grams / portionGrams : 0
  const after = dayKcal + n.kcal

  return (
    <div className="overlay" onClick={props.onClose}>
      <div className="bottom-sheet" role="dialog" aria-label={`Cantidad de ${name}`} onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head">
          <div>
            <h2>{name}</h2>
            <span className="hint">{MEALS.find((m) => m.id === meal)!.label}</span>
          </div>
          <button className="close" aria-label="Cerrar" onClick={props.onClose}>×</button>
        </div>

        {editing && <MealTabs value={meal} onChange={setMeal} />}

        <div className="chips">
          {chips.map((c) => (
            <button key={c.label} className={grams === c.grams ? 'chip on' : 'chip'} onClick={() => setText(String(c.grams))}>
              {c.label}
            </button>
          ))}
          <button className={chips.some((c) => c.grams === grams) ? 'chip' : 'chip on'} onClick={() => input.current?.select()}>
            Otra
          </button>
        </div>

        <div className="stepper">
          <button aria-label="Menos" onClick={() => step(-1)}>−</button>
          <label className="stepper-value">
            <span><input ref={input} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label="Gramos" /> g</span>
            {hasPortion && <small>{fmt('protein', portions)} {portions === 1 ? 'porción' : 'porciones'}</small>}
          </label>
          <button aria-label="Más" onClick={() => step(1)}>+</button>
        </div>

        <div className="macro-tiles">
          <div><i className="dot protein" /><b>{fmt('protein', n.protein)} g</b><span>Proteína</span></div>
          <div><i className="dot carbs" /><b>{fmt('carbs', n.carbs)} g</b><span>Carbohidratos</span></div>
          <div><i className="dot fat" /><b>{fmt('fat', n.fat)} g</b><span>Grasa</span></div>
        </div>

        <div className="day-after">
          <div><span>Tu día después de esto</span><span>{fmt('kcal', after)}{goalKcal ? ` / ${fmt('kcal', goalKcal)}` : ''} kcal</span></div>
          {goalKcal ? (
            <div className="day-track">
              <div style={{ width: `${Math.min(100, (dayKcal / goalKcal) * 100)}%` }} />
              <div className="adding" style={{ width: `${Math.max(0, Math.min(100, (after / goalKcal) * 100) - Math.min(100, (dayKcal / goalKcal) * 100))}%` }} />
            </div>
          ) : null}
        </div>

        <button className="primary big" disabled={grams <= 0} onClick={() => props.onConfirm(grams, meal)}>
          {editing ? 'Guardar cambios' : 'Agregar'} · {fmt('kcal', n.kcal)} kcal
        </button>
        {editing && props.onDelete && <button className="link danger-link" onClick={props.onDelete}>Quitar del día</button>}
      </div>
    </div>
  )
}
