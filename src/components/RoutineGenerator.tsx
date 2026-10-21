// "Genérame la mejor rutina": usa tus días de pesas, minutos y objetivo de Metas,
// y te pregunta dónde entrenas.
import { useMemo, useState } from 'react'
import type { Routine } from '../lib/db'
import { exerciseName, type Place } from '../lib/exercises'
import { OBJECTIVES, type Goals, type Objective } from '../lib/goals'
import { generate, replaceRoutines, saveTrainingPrefs, targetText } from '../lib/training'
import { Info } from './GoalWizard'
import { BackIcon } from './Icons'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const PLACES: { id: Place; label: string; sub: string }[] = [
  { id: 'gimnasio', label: 'Gimnasio', sub: 'Barras, máquinas y poleas' },
  { id: 'casa', label: 'Casa', sub: 'Mancuernas y tu cuerpo' },
  { id: 'corporal', label: 'Sin equipo', sub: 'Solo tu cuerpo' },
]

interface Props {
  goals: Goals | null | undefined
  place: Place
  existing: Routine[]
  onDone: () => void
  onClose: () => void
}

export function RoutineGenerator({ goals, place: initialPlace, existing, onDone, onClose }: Props) {
  const p = goals?.profile
  const [days, setDays] = useState<number[]>(p?.weightsDays.length ? p.weightsDays : [0, 2, 4])
  const [minutes, setMinutes] = useState(p?.weightsMinutes ?? 60)
  const [place, setPlace] = useState<Place>(initialPlace)
  const [objective, setObjective] = useState<Objective>(p?.objective ?? 'ganar')
  const [step, setStep] = useState(0)
  const routines = useMemo(() => generate({ days, minutes, place, objective }), [days, minutes, place, objective])

  async function use() {
    await saveTrainingPrefs({ place })
    await replaceRoutines(routines)
    onDone()
  }

  if (step === 1) {
    return (
      <div className="fullscreen wizard">
        <div className="wiz-top">
          <button className="icon-btn" aria-label="Atrás" onClick={() => setStep(0)}><BackIcon /></button>
          <span className="plan-title">Tu rutina</span>
          <span className="spacer" />
        </div>
        <div className="wiz-title"><h1>{routines.length} {routines.length === 1 ? 'día' : 'días'} de pesas</h1><span>{splitText(routines.length, objective)}</span></div>
        {routines.map((r) => (
          <section key={r.name} className="card gen-day">
            <div className="row-between"><b>{r.name}</b><span className="goal-tag soft">{r.days.map((d) => DAY_NAMES[d]).join(', ')}</span></div>
            {r.exercises.map((x) => (
              <div key={x.exerciseId} className="gen-row"><span>{exerciseName(x.exerciseId)}</span><small>{targetText(x)}</small></div>
            ))}
          </section>
        ))}
        {existing.length > 0 && <Info>Reemplaza tus {existing.length} rutinas actuales. Tus entrenos pasados y tu progreso no se borran.</Info>}
        <div className="wiz-actions"><button className="primary big" onClick={use}>Usar estas rutinas</button></div>
      </div>
    )
  }

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">La mejor rutina para ti</span>
        <span className="spacer" />
      </div>
      <div className="wiz-title"><h1>Te la armo con tu plan</h1><span>Tomé tus días, minutos y objetivo de Metas. Cámbialos si quieres.</span></div>

      <div className="stack-tight">
        <span className="field-label">¿Dónde entrenas?</span>
        <div className="kind-pick">
          {PLACES.map((x) => <button key={x.id} className={place === x.id ? 'on' : ''} onClick={() => setPlace(x.id)}>{x.label}<small>{x.sub}</small></button>)}
        </div>
      </div>
      <div className="stack-tight">
        <span className="field-label">Días de pesas</span>
        <div className="day-chips">
          {DAYS.map((d, i) => (
            <button key={d} className={days.includes(i) ? 'on' : ''} aria-label={DAY_NAMES[i]} aria-pressed={days.includes(i)}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
          ))}
        </div>
      </div>
      <div className="stack-tight">
        <span className="field-label">Minutos por entreno</span>
        <div className="chips">{[30, 45, 60, 75, 90].map((m) => <button key={m} className={minutes === m ? 'chip on' : 'chip'} onClick={() => setMinutes(m)}>{m}</button>)}</div>
      </div>
      <div className="stack-tight">
        <span className="field-label">Tu objetivo</span>
        <div className="chips">{OBJECTIVES.map((o) => <button key={o.id} className={objective === o.id ? 'chip on' : 'chip'} onClick={() => setObjective(o.id)}>{o.label}</button>)}</div>
      </div>
      {days.length > 6 && <Info>Con 7 días no queda descanso: te armo 6 y el séptimo descansas.</Info>}
      <div className="wiz-actions"><button className="primary big" disabled={!days.length} onClick={() => setStep(1)}>Generar mi rutina</button></div>
    </div>
  )
}

function splitText(n: number, objective: Objective) {
  const light = objective === 'perder' || objective === 'sano' || objective === 'mantener'
  if (n <= 2 || (n === 3 && light)) return 'Cuerpo completo cada día: cada músculo se trabaja varias veces por semana.'
  if (n === 3) return 'Empuje (pecho, hombro, tríceps), jalón (espalda, bíceps) y pierna.'
  if (n === 4) return 'Torso y pierna, dos veces cada uno: cada músculo 2 veces por semana.'
  return 'Empuje, jalón y pierna con más volumen: cada músculo unas 2 veces por semana.'
}
