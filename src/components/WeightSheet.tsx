// Hoja de abajo para anotar tu peso de un día (o corregirlo).
import { useState } from 'react'
import { dayKey, longDate } from '../lib/dates'
import { deleteWeight, saveWeight } from '../lib/weight'
import { fmt } from '../lib/nutrition'
import { Info } from './GoalWizard'

interface Props {
  date?: string // por defecto hoy
  kg?: number // con lo que arranca: lo que ya anotaste ese día o tu última pesada
  existing?: boolean // ya había un peso ese día
  onClose: () => void
}

export function WeightSheet({ date: initialDate, kg, existing, onClose }: Props) {
  const today = dayKey()
  const [date, setDate] = useState(initialDate ?? today)
  const [text, setText] = useState(kg ? String(kg).replace('.', ',') : '')
  const value = parseFloat(text.replace(',', '.'))
  const valid = Number.isFinite(value) && value >= 25 && value <= 350
  const step = (dir: 1 | -1) => setText(fmt('protein', Math.round(((valid ? value : 70) + dir * 0.1) * 10) / 10))

  async function save() {
    await saveWeight(date, value)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label="Anotar peso" onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head">
          <div>
            <h2>{date === today ? 'Peso de hoy' : 'Peso'}</h2>
            <span className="hint">
              {longDate(date).replace(/^./, (c) => c.toUpperCase())} ·{' '}
              <label className="date-link">cambiar día<input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Día" /></label>
            </span>
          </div>
          <button className="close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>

        <div className="stepper kg-stepper">
          <button aria-label="Menos" onClick={() => step(-1)}>−</button>
          <label className="stepper-value">
            <span><input inputMode="decimal" value={text} placeholder="—" onChange={(e) => setText(e.target.value)} aria-label="Kilos" autoFocus={!kg} /> kg</span>
            <small>Toca el número para escribirlo · ± 0,1 kg</small>
          </label>
          <button aria-label="Más" onClick={() => step(1)}>+</button>
        </div>

        <div className="card weight-tip">
          <b>Para que sea comparable</b>
          <span>Pésate al despertar, después de ir al baño y antes de comer o tomar algo. Mejor todos los días o casi: así la tendencia se ve rápido.</span>
        </div>
        <Info>Tu peso sube y baja hasta 1 kg de un día a otro por agua y sal. No te fijes en el número del día: la app mira la tendencia.</Info>

        <button className="primary big" disabled={!valid} onClick={save}>Guardar</button>
        {existing && <button className="link danger-link" onClick={async () => { await deleteWeight(date); onClose() }}>Borrar esta pesada</button>}
      </div>
    </div>
  )
}
