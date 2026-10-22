// El entreno en vivo (series, kilos, reps y descanso) y el resumen al terminar.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Workout, type WorkoutSet } from '../lib/db'
import { exerciseById, exerciseName, type Place } from '../lib/exercises'
import { bodyKg, dose, groups, kgText, lastSets, minutesLabel, parseNum, patchWorkout, recordsOf, restText, suggestKg, useWorkouts, volumeOf, weightsKcal, epley } from '../lib/training'
import { fromKey } from '../lib/dates'
import type { Goals } from '../lib/goals'
import { ExercisePicker } from './RoutineEditor'
import type { Injury } from '../lib/conditions'
import { Info } from './GoalWizard'
import { CheckIcon } from './Icons'

const kgLabel = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`

// Un campo de número que deja escribir "97,5" con calma y guarda al salir.
function NumInput({ value, label, onCommit, highlight }: { value: number; label: string; onCommit: (n: number) => void; highlight?: boolean }) {
  const [text, setText] = useState(value ? kgText(value) : '')
  const [focused, setFocused] = useState(false)
  const shown = focused ? text : value ? kgText(value) : ''
  return (
    <input className={'set-input' + (highlight ? ' hl' : '')} inputMode="decimal" aria-label={label} value={shown} placeholder="0"
      onFocus={(e) => { setText(value ? kgText(value) : ''); setFocused(true); e.target.select() }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setFocused(false); onCommit(parseNum(text)) }} />
  )
}

interface Props {
  id: number
  goals: Goals | null | undefined
  place: Place
  injuries: Injury[]
  onFinished: (id: number) => void
  onProgress: (exerciseId: string) => void
  onClose: () => void
}

export function LiveWorkout({ id, goals, place, injuries, onFinished, onProgress, onClose }: Props) {
  const workout = useLiveQuery(() => db.workouts.get(id), [id])
  const workouts = useWorkouts() ?? []
  const [now, setNow] = useState(() => Date.now())
  const [rest, setRest] = useState<number | null>(null) // hasta cuándo (ms)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState<'finish' | 'cancel' | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (workout === undefined) return null
  if (!workout) return <div className="fullscreen wizard"><button className="link" onClick={onClose}>Volver</button></div>
  const w = workout
  const edit = (fn: (x: Workout) => Workout) => patchWorkout(w.id!, fn)
  const setSet = (index: number, patch: Partial<WorkoutSet>) => edit((x) => ({ ...x, sets: x.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) }))
  const left = rest ? Math.max(0, rest - now) : 0
  const doneCount = w.sets.filter((s) => s.done).length

  async function finish() {
    if (!doneCount) { await db.workouts.delete(w.id!); onClose(); return }
    const endedAt = Date.now()
    const kcal = weightsKcal((endedAt - w.startedAt) / 60000, await bodyKg())
    await edit((x) => ({ ...x, sets: x.sets.filter((s) => s.done), endedAt, kcal }))
    onFinished(w.id!)
  }

  if (picking) {
    return (
      <ExercisePicker current={w.plan} place={place} injuries={injuries} onClose={() => setPicking(false)} onPick={(e) => {
        const plan = { exerciseId: e.id, ...dose(e, goals?.profile?.objective ?? 'ganar', false) }
        const last = lastSets(workouts, e.id, w.id)
        const { kg } = suggestKg(last, plan)
        edit((x) => ({ ...x, plan: [...x.plan, plan], sets: [...x.sets, ...Array.from({ length: plan.sets }, (_, i) => ({ exerciseId: e.id, kg, reps: last[i]?.reps ?? plan.repsMin, done: false }))] }))
        setPicking(false)
      }} />
    )
  }

  return (
    <div className="fullscreen wizard live">
      <div className="live-top">
        <span className="live-time"><small>{w.name}</small><b>{minutesLabel(now - w.startedAt)}</b></span>
        <button className="dark-btn" onClick={() => setConfirm('finish')}>Terminar</button>
      </div>
      {left > 0 && (
        <div className="rest-bar" role="timer" aria-label="Descanso">
          <span>Descanso</span><b>{minutesLabel(left)}</b>
          <button onClick={() => setRest((r) => (r ? Math.max(Date.now(), r - 15000) : r))}>−15 s</button>
          <button onClick={() => setRest((r) => (r ? r + 15000 : r))}>+15 s</button>
          <button aria-label="Saltar descanso" onClick={() => setRest(null)}>×</button>
        </div>
      )}

      {groups(w).map((g) => {
        const e = exerciseById.get(g.exerciseId)
        const last = lastSets(workouts, g.exerciseId, w.id)
        const sug = g.plan ? suggestKg(last, g.plan) : { kg: 0, up: false }
        const unit = g.exerciseId === 'plancha' ? 's' : 'reps'
        const allDone = g.sets.length > 0 && g.sets.every((x) => x.s.done)
        return (
          <section key={g.exerciseId} className={'card live-ex' + (allDone ? ' done' : '')}>
            <div className="row-between">
              <span className="option-text"><b className="live-name">{exerciseName(g.exerciseId)}</b>
                <small>{g.plan ? `Meta: ${g.plan.sets} series de ${g.plan.repsMin} a ${g.plan.repsMax} ${unit}` : ''}{last.length && !e?.bodyweight ? ` · última vez ${kgText(Math.max(...last.map((s) => s.kg)))} kg` : ''}</small></span>
              <button className="link small-link" onClick={() => onProgress(g.exerciseId)}>Progreso</button>
            </div>
            <div className="set-head"><span>Serie</span><span>Anterior</span>{!e?.bodyweight && <span>kg</span>}<span>{unit}</span><span /></div>
            {g.sets.map(({ s, index }, i) => (
              <div key={index} className={'set-row' + (s.done ? ' done' : '')}>
                <span className="set-n">{i + 1}</span>
                <span className="set-prev">{last[i] ? (e?.bodyweight ? `${last[i].reps}` : `${kgText(last[i].kg)} × ${last[i].reps}`) : '—'}</span>
                {!e?.bodyweight && <NumInput key={`kg-${index}-${s.kg}`} value={s.kg} label={`Kilos serie ${i + 1}`} onCommit={(kg) => kg !== s.kg && setSet(index, { kg })} />}
                <NumInput key={`r-${index}-${s.reps}`} value={s.reps} label={`Repeticiones serie ${i + 1}`} onCommit={(reps) => reps !== s.reps && setSet(index, { reps: Math.round(reps) })} />
                <button className={'set-check' + (s.done ? ' on' : '')} aria-label={`Serie ${i + 1} hecha`} aria-pressed={s.done}
                  onClick={() => { setSet(index, { done: !s.done }); if (!s.done) setRest(Date.now() + (g.plan?.rest ?? 90) * 1000) }}>
                  <CheckIcon />
                </button>
              </div>
            ))}
            <button className="link add-line" onClick={() => {
              const lastSet = g.sets.at(-1)?.s
              edit((x) => ({ ...x, sets: [...x.sets, { exerciseId: g.exerciseId, kg: lastSet?.kg ?? 0, reps: lastSet?.reps ?? g.plan?.repsMin ?? 10, done: false }] }))
            }}>+ Agregar serie</button>
            {sug.up && <p className="pr-note">↑ Hoy toca subir a {kgText(sug.kg)} kg: la última vez completaste todas las series.</p>}
            {g.plan && <small className="hint small">Descanso entre series: {restText(g.plan.rest)}</small>}
          </section>
        )
      })}

      <button className="secondary big-secondary" onClick={() => setPicking(true)}>+ Agregar ejercicio</button>
      <button className="link danger-link" onClick={() => setConfirm('cancel')}>Cancelar entreno</button>

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="bottom-sheet" role="dialog" aria-label={confirm === 'finish' ? 'Terminar entreno' : 'Cancelar entreno'} onClick={(e) => e.stopPropagation()}>
            <span className="grabber" />
            {confirm === 'finish' ? (
              <>
                <div className="qs-head"><h2>¿Terminar el entreno?</h2></div>
                <p className="hint">{doneCount ? `Hiciste ${doneCount} de ${w.sets.length} series. Las que no marcaste no se guardan.` : 'No marcaste ninguna serie, así que no se guarda nada.'}</p>
                <div className="two-buttons"><button className="secondary" onClick={() => setConfirm(null)}>Seguir</button><button className="primary" onClick={finish}>Terminar</button></div>
              </>
            ) : (
              <>
                <div className="qs-head"><h2>¿Cancelar el entreno?</h2></div>
                <p className="hint">Se borra lo que anotaste en este entreno.</p>
                <div className="two-buttons"><button className="secondary" onClick={() => setConfirm(null)}>Seguir</button><button className="primary danger-fill" onClick={async () => { await db.workouts.delete(w.id!); onClose() }}>Cancelar entreno</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// El resumen al terminar (o al abrir un entreno pasado).
export function WorkoutSummary({ id, onProgress, onClose }: { id: number; onProgress: (exerciseId: string) => void; onClose: () => void }) {
  const workout = useLiveQuery(() => db.workouts.get(id), [id])
  const workouts = useWorkouts() ?? []
  const [confirm, setConfirm] = useState(false)
  if (!workout || !workout.endedAt) return null
  const w = workout
  const minutes = Math.round((w.endedAt! - w.startedAt) / 60000)
  const done = w.sets.filter((s) => s.done)
  const volume = volumeOf(done)
  const records = recordsOf(w, workouts)
  const prev = workouts.filter((x) => x.endedAt && x.id !== w.id && x.startedAt < w.startedAt && (w.routineId ? x.routineId === w.routineId : x.name === w.name))[0]
  const prevVolume = prev ? volumeOf(prev.sets) : 0
  const change = prevVolume ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null
  const prevMinutes = prev ? Math.round((prev.endedAt! - prev.startedAt) / 60000) : null
  return (
    <div className="fullscreen wizard summary">
      <div className="summary-hero">
        <span className="intro-icon big"><CheckIcon /></span>
        <h1>¡{w.name} {w.name.endsWith('a') ? 'lista' : 'listo'}!</h1>
        <span className="hint">{fromKey(w.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} · {minutes} minutos</span>
      </div>
      <div className="menu-stats">
        <div><b>{done.length}</b><span>series</span></div>
        <div><b>{kgLabel(volume)}</b><span>levantados</span></div>
        <div><b>≈ {w.kcal ?? 0}</b><span>kcal</span></div>
      </div>
      {records.length > 0 && (
        <div className="card">
          <h3 className="card-title">{records.length === 1 ? '1 récord nuevo' : `${records.length} récords nuevos`}</h3>
          {records.map((r) => (
            <button key={r.exerciseId} className="record-row" onClick={() => onProgress(r.exerciseId)}>
              <span className="trophy">🏆</span>
              <span className="option-text"><b>{exerciseName(r.exerciseId)}: {kgText(r.kg)} kg × {r.reps}</b>
                <small>Antes {kgText(r.before!.kg)} kg × {r.before!.reps} · 1RM estimado {Math.round(epley(r.kg, r.reps))} kg</small></span>
            </button>
          ))}
        </div>
      )}
      {prev && (
        <div className="card stack">
          <h3 className="card-title">Frente a la vez pasada</h3>
          <div className="row-between"><span className="hint">Kilos levantados</span><b className={change !== null && change >= 0 ? 'up' : ''}>{change === null ? '—' : `${change >= 0 ? '+' : '−'} ${Math.abs(change)} %`}</b></div>
          <div className="row-between"><span className="hint">Duración</span><b>{prevMinutes !== null ? `${minutes - prevMinutes >= 0 ? '+' : '−'}${Math.abs(minutes - prevMinutes)} min` : '—'}</b></div>
        </div>
      )}
      <div className="card">
        {groups(w).filter((g) => g.sets.length).map((g) => (
          <button key={g.exerciseId} className="routine-row" onClick={() => onProgress(g.exerciseId)}>
            <span className="option-text"><b>{exerciseName(g.exerciseId)}</b><small>{g.sets.map(({ s }) => (exerciseById.get(s.exerciseId)?.bodyweight ? `${s.reps}` : `${kgText(s.kg)}×${s.reps}`)).join(' · ')}</small></span>
          </button>
        ))}
      </div>
      <Info>Estas calorías ya están contadas en tu meta de los días de entreno. No tienes que comer de más.</Info>
      <div className="wiz-actions"><button className="primary big" onClick={onClose}>Listo</button></div>
      {confirm
        ? <button className="link danger-link" onClick={async () => { await db.workouts.delete(w.id!); onClose() }}>Sí, borrar este entreno</button>
        : <button className="link danger-link" onClick={() => setConfirm(true)}>Borrar entreno</button>}
    </div>
  )
}
