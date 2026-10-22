// Pestaña "Entreno": tu semana, lo que toca hoy, tus rutinas y tu cardio.
import { useState } from 'react'
import type { Routine } from '../lib/db'
import { dayKey, fromKey, longDate, weekOf } from '../lib/dates'
import { useGoals } from '../lib/goals'
import { exerciseName, muscleLabel, exerciseById, type Muscle } from '../lib/exercises'
import { CARDIO_TYPES, plannedFor, startWorkout, useCardio, useRoutines, useTrainingPrefs, useWorkouts } from '../lib/training'
import { weekdayOf } from '../lib/plans'
import { usePerfil } from '../lib/perfil'
import { RoutineEditor } from './RoutineEditor'
import { RoutineGenerator } from './RoutineGenerator'
import { LiveWorkout, WorkoutSummary } from './LiveWorkout'
import { ExerciseProgress } from './ExerciseProgress'
import { CardioSheet } from './CardioSheet'
import { Option } from './GoalWizard'
import { CheckIcon, DumbbellIcon, ObjectiveIcon, PlusIcon, RunIcon } from './Icons'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type View =
  | { type: 'home' }
  | { type: 'routine'; routine: Routine | null }
  | { type: 'generate' }
  | { type: 'live'; id: number }
  | { type: 'summary'; id: number }
  | { type: 'progress'; exerciseId: string; back: View }

// "Pecho, hombro y tríceps"
function musclesOf(r: Routine) {
  const ms: Muscle[] = []
  for (const x of r.exercises) {
    const m = exerciseById.get(x.exerciseId)?.muscle
    if (m && !ms.includes(m) && m !== 'core') ms.push(m)
  }
  const labels = ms.slice(0, 3).map((m, i) => (i ? muscleLabel(m).toLowerCase() : muscleLabel(m)))
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}` : labels[0] ?? ''
}

export function TrainingScreen() {
  const goals = useGoals()
  const routines = useRoutines()
  const workouts = useWorkouts()
  const cardio = useCardio()
  const prefs = useTrainingPrefs()
  const perfil = usePerfil()
  const [view, setView] = useState<View>({ type: 'home' })
  const [sheet, setSheet] = useState<'new' | 'cardio' | 'pick' | null>(null)
  const home = () => setView({ type: 'home' })
  const progress = (back: View) => (exerciseId: string) => setView({ type: 'progress', exerciseId, back })

  if (!routines || !workouts || !cardio || !prefs) return null
  const place = prefs.place

  if (view.type === 'progress') return <ExerciseProgress exerciseId={view.exerciseId} onClose={() => setView(view.back)} />
  if (view.type === 'routine') return <RoutineEditor routine={view.routine} goals={goals} place={place} perfil={perfil} onProgress={progress(view)} onClose={home} />
  if (view.type === 'generate') return <RoutineGenerator goals={goals} place={place} perfil={perfil} existing={routines} onDone={home} onClose={home} />
  if (view.type === 'live') return <LiveWorkout id={view.id} goals={goals} place={place} injuries={perfil?.injuries ?? []} onFinished={(id) => setView({ type: 'summary', id })} onProgress={progress(view)} onClose={home} />
  if (view.type === 'summary') return <WorkoutSummary id={view.id} onProgress={progress(view)} onClose={home} />

  const today = dayKey()
  const wd = weekdayOf(today)
  const week = weekOf(today)
  const active = workouts.find((w) => !w.endedAt)
  const planned = plannedFor(goals, wd)
  const todays = routines.filter((r) => r.days.includes(wd))
  const nextRoutine = todays[0] ?? null
  const doneToday = workouts.some((w) => w.endedAt && w.date === today) || (!nextRoutine && cardio.some((c) => c.date === today))
  const trainedOn = (d: string) => workouts.some((w) => w.endedAt && w.date === d) || cardio.some((c) => c.date === d)
  const plannedDays = week.filter((_, i) => { const p = plannedFor(goals, i); return p.weights || p.cardio || routines.some((r) => r.days.includes(i)) }).length
  const doneDays = week.filter(trainedOn).length
  const lastCardio = cardio[0]
  const recent = workouts.filter((w) => w.endedAt).slice(0, 4)

  async function start(r: Routine | null) {
    setSheet(null)
    const id = await startWorkout(r, workouts ?? [])
    setView({ type: 'live', id })
  }

  return (
    <section className="screen">
      <header className="top">
        <span className="greeting">{longDate(today).replace(/^./, (c) => c.toUpperCase())}</span>
        <h1>Entreno</h1>
      </header>

      <div className="card stack">
        <div className="row-between"><b>Esta semana</b><span className="hint small">{doneDays} de {plannedDays || '—'} entrenos</span></div>
        <div className="train-week">
          {week.map((d, i) => {
            const p = plannedFor(goals, i)
            const hasRoutine = routines.some((r) => r.days.includes(i))
            const kind = p.weights || hasRoutine ? 'P' : p.cardio ? 'C' : ''
            const done = trainedOn(d)
            return (
              <div key={d}>
                <span>{DAYS[i]}</span>
                <b className={[done ? 'done' : '', kind === 'P' ? 'k-p' : kind === 'C' ? 'k-c' : 'k-none', d === today ? 'today' : ''].join(' ')} aria-label={`${DAY_SHORT[i]}: ${done ? 'hecho' : kind === 'P' ? 'pesas' : kind === 'C' ? 'cardio' : 'descanso'}`}>
                  {done ? <CheckIcon /> : kind || '—'}
                </b>
              </div>
            )
          })}
        </div>
      </div>

      {active ? (
        <section className="goal-card train-today">
          <div className="row-between"><span className="gauge-label">Entreno en curso</span><span className="goal-tag">{active.sets.filter((s) => s.done).length} de {active.sets.length} series</span></div>
          <span className="train-name">{active.name}</span>
          <button className="white-btn" onClick={() => setView({ type: 'live', id: active.id! })}>Seguir entreno</button>
        </section>
      ) : routines.length === 0 ? (
        <section className="card stack train-empty">
          <span className="intro-icon"><DumbbellIcon /></span>
          <b>Arma tu rutina</b>
          <span className="hint">Te genero la mejor rutina según tus metas ({goals?.profile ? `${goals.profile.weightsDays.length} días de pesas, ${goals.profile.weightsMinutes} min` : 'días y minutos'}), o la armas tú con los ejercicios que quieras.</span>
          <button className="primary big" onClick={() => setView({ type: 'generate' })}>Genérame la mejor rutina</button>
          <button className="link" onClick={() => setView({ type: 'routine', routine: null })}>La armo yo</button>
        </section>
      ) : (
        <section className="goal-card train-today">
          <div className="row-between">
            <span className="gauge-label">{doneToday ? 'Hoy ya entrenaste' : nextRoutine ? 'Hoy toca · día de pesas' : planned.cardio ? 'Hoy toca cardio' : 'Hoy es día de descanso'}</span>
            {nextRoutine && !doneToday && <span className="goal-tag">{nextRoutine.exercises.length} ejercicios</span>}
          </div>
          <span className="train-name">{nextRoutine && !doneToday ? nextRoutine.name : doneToday ? '¡Bien hecho!' : planned.cardio ? 'Cardio' : 'Descansa'}</span>
          {nextRoutine && !doneToday && <span className="train-list">{nextRoutine.exercises.map((x) => exerciseName(x.exerciseId)).join(' · ')}</span>}
          {nextRoutine && !doneToday
            ? <button className="white-btn" onClick={() => start(nextRoutine)}>Empezar entreno</button>
            : planned.cardio && !doneToday
              ? <button className="white-btn" onClick={() => setSheet('cardio')}>Anotar cardio</button>
              : <button className="white-btn ghost" onClick={() => setSheet('pick')}>Entrenar igual</button>}
          {!nextRoutine && planned.cardio && !doneToday && <button className="link light-link" onClick={() => setSheet('pick')}>Hacer una rutina de pesas</button>}
        </section>
      )}

      <div className="row-between plans-head">
        <h2>Tus rutinas</h2>
        <button className="round-btn small accent" aria-label="Nueva rutina" onClick={() => setSheet('new')}><PlusIcon /></button>
      </div>
      {routines.map((r) => (
        <button key={r.id} className="card routine-card" onClick={() => setView({ type: 'routine', routine: r })}>
          <span className="routine-icon"><DumbbellIcon /></span>
          <span className="option-text"><b>{r.name}</b><small>{musclesOf(r)} · {r.exercises.length} ejercicios</small></span>
          <span className="routine-days">{r.days.length ? r.days.map((d) => DAY_SHORT[d]).join(' · ') : 'Sin día'}</span>
        </button>
      ))}
      {routines.length > 0 && <button className="link small-link center" onClick={() => setView({ type: 'generate' })}>Generar de nuevo según mis metas</button>}

      <button className="card routine-card" onClick={() => setSheet('cardio')}>
        <span className="routine-icon cardio"><RunIcon /></span>
        <span className="option-text"><b>Cardio</b><small>{lastCardio ? `${DAY_SHORT[weekdayOf(lastCardio.date)]}: ${lastCardio.minutes} min de ${CARDIO_TYPES.find((t) => t.id === lastCardio.type)?.label.toLowerCase()} · ≈ ${lastCardio.kcal} kcal` : 'Anota caminatas, bici, elíptica…'}</small></span>
        <span className="routine-days">Anotar</span>
      </button>

      {recent.length > 0 && (
        <>
          <h2 className="section-title">Últimos entrenos</h2>
          <div className="card">
            {recent.map((w) => (
              <button key={w.id} className="routine-row" onClick={() => setView({ type: 'summary', id: w.id! })}>
                <span className="option-text"><b>{w.name}</b><small>{fromKey(w.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} · {Math.round((w.endedAt! - w.startedAt) / 60000)} min · {w.sets.length} series</small></span>
              </button>
            ))}
          </div>
        </>
      )}

      {sheet === 'new' && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <div className="bottom-sheet" role="dialog" aria-label="Nueva rutina" onClick={(e) => e.stopPropagation()}>
            <span className="grabber" />
            <div className="qs-head"><h2>Nueva rutina</h2><button className="close" aria-label="Cerrar" onClick={() => setSheet(null)}>×</button></div>
            <Option icon={<ObjectiveIcon id="sliders" />} title="Genérame la mejor rutina" tag="Recomendado" sub="Según tus días de pesas, minutos y objetivo." on={false}
              onClick={() => { setSheet(null); setView({ type: 'generate' }) }} />
            <Option icon={<DumbbellIcon />} title="La armo yo" sub="Eliges los ejercicios; te recomiendo los que faltan." on={false}
              onClick={() => { setSheet(null); setView({ type: 'routine', routine: null }) }} />
          </div>
        </div>
      )}
      {sheet === 'pick' && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <div className="bottom-sheet" role="dialog" aria-label="¿Qué entrenas?" onClick={(e) => e.stopPropagation()}>
            <span className="grabber" />
            <div className="qs-head"><h2>¿Qué entrenas hoy?</h2><button className="close" aria-label="Cerrar" onClick={() => setSheet(null)}>×</button></div>
            <div className="card">
              {routines.map((r) => (
                <button key={r.id} className="routine-row" onClick={() => start(r)}>
                  <span className="option-text"><b>{r.name}</b><small>{musclesOf(r)}</small></span>
                </button>
              ))}
              <button className="routine-row" onClick={() => start(null)}><span className="option-text"><b>Entreno libre</b><small>Agregas los ejercicios sobre la marcha</small></span></button>
            </div>
            <button className="secondary big-secondary" onClick={() => setSheet('cardio')}>Anotar cardio</button>
          </div>
        </div>
      )}
      {sheet === 'cardio' && <CardioSheet minutes={goals?.profile?.cardioMinutes ?? 30} onClose={() => setSheet(null)} />}
    </section>
  )
}

