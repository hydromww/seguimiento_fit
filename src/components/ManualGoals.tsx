// "Ya sé mis números": escribes tus calorías y macros (en gramos, g por kilo o %),
// y si quieres una meta distinta los días de entreno.
import { useState } from 'react'
import { finish, saveGoals, splitDays, type Goals } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { DayPicker, Info, NumberField, Segmented } from './GoalWizard'

type Unit = 'g' | 'gkg' | 'pct'

interface Props {
  goals?: Goals | null
  weight?: number // para "g por kilo"
  onDone: () => void
  onClose: () => void
}

export function ManualGoals({ goals, weight: initialWeight, onDone, onClose }: Props) {
  const d = goals?.daily
  const [kcal, setKcal] = useState(d?.kcal ?? 2000)
  const [unit, setUnit] = useState<Unit>('g')
  const [weight, setWeight] = useState(initialWeight ?? goals?.profile?.weight)
  const [protein, setProtein] = useState(d?.protein ?? 140) // siempre guardado en gramos
  const [fat, setFat] = useState(d?.fat ?? 60)
  const [fiber, setFiber] = useState(d?.fiber)
  const [sugar, setSugar] = useState(d?.sugar)
  const [sodium, setSodium] = useState(d?.sodium)
  const [split, setSplit] = useState(!!goals?.high)
  const [highDays, setHighDays] = useState(goals?.highDays.length ? goals.highDays : [0, 2, 4])
  const [extra, setExtra] = useState(goals?.high && goals.low ? goals.high.kcal - goals.low.kcal : 300)
  const [version, setVersion] = useState(0) // para refrescar los campos al cambiar de unidad

  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4)
  const over = protein * 4 + fat * 9 > kcal
  // Conversión entre gramos, gramos por kilo y porcentaje de las calorías.
  const toUnit = (g: number, kPerG: number) =>
    unit === 'g' ? Math.round(g) : unit === 'gkg' ? (weight ? Math.round((g / weight) * 10) / 10 : undefined) : Math.round(((g * kPerG) / kcal) * 100)
  const fromUnit = (v: number | undefined, kPerG: number) =>
    v === undefined ? 0 : unit === 'g' ? v : unit === 'gkg' ? v * (weight ?? 0) : (v / 100) * kcal / kPerG
  const unitLabel = unit === 'g' ? 'g' : unit === 'gkg' ? 'g/kg' : '%'

  async function save() {
    const daily = finish(kcal, protein, carbs, fat, { fiber: fiber ?? undefined, sugar: sugar ?? undefined, sodium: sodium ?? undefined })
    const days = split ? highDays : []
    await saveGoals({ mode: 'manual', daily, highDays: days, profile: goals?.profile, updatedAt: Date.now(), ...splitDays(daily, days, extra) })
    onDone()
  }

  return (
    <div className="fullscreen wizard">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>Cancelar</button>
        <h2>Mis números</h2>
        <button className="link strong" onClick={save} disabled={over}>Guardar</button>
      </header>

      <div className="card stack">
        <h4>Calorías al día</h4>
        <div className="kcal-stepper">
          <button aria-label="Menos" onClick={() => setKcal(Math.max(1000, kcal - 50))}>−</button>
          <input inputMode="numeric" aria-label="Calorías" value={kcal} onChange={(e) => setKcal(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          <button aria-label="Más" onClick={() => setKcal(kcal + 50)}>+</button>
        </div>
      </div>

      <div className="stack">
        <h4>Macros en</h4>
        <Segmented small options={[['g', 'Gramos'], ['gkg', 'g por kilo'], ['pct', 'Porcentaje']]} value={unit} onChange={(u) => { setUnit(u); setVersion(version + 1) }} />
      </div>
      {unit === 'gkg' && !weight && (
        <NumberField label="Tu peso" unit="kg" value={weight} onChange={(w) => { setWeight(w); setVersion(version + 1) }} />
      )}

      <div className="card" key={version}>
        <div className="macro-input">
          <i className="dot protein" /><b>Proteína</b>
          <small>{Math.round(protein)} g · {Math.round((protein * 4 / kcal) * 100)} %</small>
          <NumberField label="" unit={unitLabel} value={toUnit(protein, 4)} onChange={(v) => setProtein(fromUnit(v, 4))} />
        </div>
        <div className="macro-input">
          <i className="dot fat" /><b>Grasa</b>
          <small>{Math.round(fat)} g · {Math.round((fat * 9 / kcal) * 100)} %</small>
          <NumberField label="" unit={unitLabel} value={toUnit(fat, 9)} onChange={(v) => setFat(fromUnit(v, 9))} />
        </div>
        <div className="macro-input last">
          <i className="dot carbs" /><b>Carbohidratos</b>
          <small>el resto · {Math.round(carbs)} g · {Math.round((carbs * 4 / kcal) * 100)} %</small>
        </div>
      </div>
      {over && <p className="error">La proteína y la grasa ya suman más calorías que tu meta. Baja alguna de las dos o sube las calorías.</p>}

      <div className="card stack">
        <h4>Otras metas (opcional)</h4>
        <div className="field-grid three">
          <NumberField label="Fibra mín." unit="g" value={fiber} onChange={setFiber} />
          <NumberField label="Azúcar máx." unit="g" value={sugar} onChange={setSugar} />
          <NumberField label="Sodio máx." unit="mg" value={sodium} onChange={setSodium} />
        </div>
        <span className="hint">Si las dejas vacías: fibra {fmt('kcal', Math.round(kcal / 1000 * 14))} g, azúcar {fmt('kcal', Math.round(kcal * 0.1 / 4))} g y sodio 2.000 mg.</span>
      </div>

      <div className="card stack">
        <label className="switch-row">
          <b>Distinta en días de entreno</b>
          <input type="checkbox" role="switch" checked={split} onChange={(e) => setSplit(e.target.checked)} />
        </label>
        {split && (
          <>
            <DayPicker value={highDays} onChange={setHighDays} />
            <NumberField label="Calorías de más en esos días" unit="kcal" value={extra} onChange={(v) => setExtra(v ?? 0)} />
            <Info>Esas calorías van en carbohidratos y se restan de los otros días, así tu promedio semanal sigue en {fmt('kcal', kcal)} kcal.</Info>
          </>
        )}
      </div>
    </div>
  )
}
