// Armar o editar una rutina: nombre, días, ejercicios con sus series, y los recomendados.
import { useState } from 'react'
import type { Routine, RoutineExercise } from '../lib/db'
import { EXERCISES, exerciseById, exerciseName, MUSCLES, muscleLabel, available, type Exercise, type Muscle, type Place } from '../lib/exercises'
import { normalize } from '../lib/icbf'
import type { Goals } from '../lib/goals'
import { buildSession, deleteRoutine, dose, exercisesFor, recommend, restText, saveRoutine, targetText, TEMPLATES } from '../lib/training'
import { careOf, cautionFor, type Injury } from '../lib/conditions'
import type { Perfil } from '../lib/perfil'
import { BackIcon, SearchIcon } from './Icons'
import { Info } from './GoalWizard'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

interface Props {
  routine: Routine | null // null = nueva
  goals: Goals | null | undefined
  place: Place
  perfil: Perfil | undefined
  onProgress: (exerciseId: string) => void
  onClose: () => void
}

export function RoutineEditor({ routine, goals, place, perfil, onProgress, onClose }: Props) {
  const objective = goals?.profile?.objective ?? 'ganar'
  const [name, setName] = useState(routine?.name ?? '')
  const [days, setDays] = useState<number[]>(routine?.days ?? [])
  const [list, setList] = useState<RoutineExercise[]>(routine?.exercises ?? [])
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const weightsDays = goals?.profile?.weightsDays ?? []
  const care = careOf(perfil)
  const injuries = perfil?.injuries ?? []

  const add = (e: Exercise) => setList((l) => [...l, { exerciseId: e.id, ...dose(e, objective, e.compound && l.filter((x) => exerciseById.get(x.exerciseId)?.compound).length < 2, care) }])
  function applyTemplate(t: string) {
    setList(buildSession(t, exercisesFor(goals?.profile?.weightsMinutes ?? 60), place, objective, undefined, care))
    if (!name.trim()) setName(t)
  }
  async function save() {
    await saveRoutine({ ...(routine?.id ? { id: routine.id } : {}), name: name.trim() || 'Mi rutina', days: [...days].sort(), exercises: list, createdAt: routine?.createdAt ?? Date.now() })
    onClose()
  }

  if (picking) return <ExercisePicker current={list} place={place} injuries={injuries} onPick={(e) => { add(e); setPicking(false) }} onClose={() => setPicking(false)} />

  const item = editing !== null ? list[editing] : null
  return (
    <div className="fullscreen wizard routine-editor">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">{routine ? 'Rutina' : 'Nueva rutina'}</span>
        <button className="link" disabled={!list.length} onClick={save}>Guardar</button>
      </div>
      <label className="field"><span>Nombre</span><input value={name} placeholder="Pierna, Empuje, Lunes…" onChange={(e) => setName(e.target.value)} /></label>
      <div className="stack-tight">
        <span className="field-label">¿Qué días la haces?</span>
        <div className="day-chips">
          {DAYS.map((d, i) => (
            <button key={d} className={days.includes(i) ? 'on' : ''} aria-label={DAY_NAMES[i]} aria-pressed={days.includes(i)}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
          ))}
        </div>
        {weightsDays.length > 0 && <span className="hint small">Tus días de pesas en Metas: {weightsDays.map((d) => DAYS[d]).join(' · ')}</span>}
      </div>

      <div className="card routine-list">
        {list.map((x, i) => (
          <button key={`${x.exerciseId}-${i}`} className="routine-row" onClick={() => setEditing(i)}>
            <span className="routine-num">{i + 1}</span>
            <span className="option-text"><b>{exerciseName(x.exerciseId)}</b><small>{targetText(x)} · descanso {restText(x.rest)}{caution(x.exerciseId, injuries)}</small></span>
            <span className="link small-link">Editar</span>
          </button>
        ))}
        {!list.length && <p className="hint">Agrega ejercicios o empieza con una rutina lista.</p>}
        <button className="link add-line" onClick={() => setPicking(true)}>+ Agregar ejercicio</button>
      </div>

      {list.length > 0 && <Recommended list={list} place={place} exclude={care.exclude} onAdd={add} />}

      {!list.length && (
        <div className="chip-group">
          <h4>Empieza con una rutina lista</h4>
          <div className="chips">{TEMPLATES.map((t) => <button key={t} className="chip" onClick={() => applyTemplate(t)}>{t}</button>)}</div>
        </div>
      )}

      {routine?.id && (confirm
        ? <button className="link danger-link" onClick={async () => { await deleteRoutine(routine.id!); onClose() }}>Sí, borrar esta rutina</button>
        : <button className="link danger-link" onClick={() => setConfirm(true)}>Borrar rutina</button>)}

      {item && (
        <ExerciseSheet item={item} index={editing!} total={list.length}
          onChange={(next) => setList(list.map((x, i) => (i === editing ? next : x)))}
          onMove={(dir) => { const j = editing! + dir; const l = [...list]; [l[editing!], l[j]] = [l[j], l[editing!]]; setList(l); setEditing(j) }}
          onDelete={() => { setList(list.filter((_, i) => i !== editing)); setEditing(null) }}
          onProgress={() => onProgress(item.exerciseId)}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

const caution = (id: string, injuries: Injury[]) => {
  const e = exerciseById.get(id)
  const c = e ? cautionFor(e, injuries) : ''
  return c ? ` · ${c}` : ''
}

function Recommended({ list, place, exclude, onAdd }: { list: RoutineExercise[]; place: Place; exclude: Set<string>; onAdd: (e: Exercise) => void }) {
  const recs = recommend(list, place, 4, exclude)
  if (!recs.length) return null
  return (
    <div className="chip-group">
      <h4>Te recomiendo agregar</h4>
      <div className="card recs">
        {recs.map((e) => (
          <button key={e.id} className="routine-row" onClick={() => onAdd(e)}>
            <span className="option-text"><b>{e.name}</b><small>{muscleLabel(e.muscle)} · {e.compound ? 'compuesto' : 'aislamiento'}</small></span>
            <span className="add-dot">+</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Cambiar series, repeticiones y descanso de un ejercicio de la rutina.
function ExerciseSheet({ item, index, total, onChange, onMove, onDelete, onProgress, onClose }: {
  item: RoutineExercise; index: number; total: number; onChange: (x: RoutineExercise) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void; onProgress: () => void; onClose: () => void
}) {
  const step = (key: 'sets' | 'repsMin' | 'repsMax' | 'rest', by: number, min: number) => {
    const next = { ...item, [key]: Math.max(min, item[key] + by) }
    if (next.repsMin > next.repsMax) {
      if (key === 'repsMin') next.repsMax = next.repsMin
      else next.repsMin = next.repsMax
    }
    onChange(next)
  }
  const row = (label: string, value: string, key: 'sets' | 'repsMin' | 'repsMax' | 'rest', by: number, min: number) => (
    <div className="mini-stepper">
      <span>{label}</span>
      <button aria-label={`Menos ${label.toLowerCase()}`} onClick={() => step(key, -by, min)}>−</button>
      <b>{value}</b>
      <button aria-label={`Más ${label.toLowerCase()}`} onClick={() => step(key, by, min)}>+</button>
    </div>
  )
  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label={exerciseName(item.exerciseId)} onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head"><h2>{exerciseName(item.exerciseId)}</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <div className="card">
          {row('Series', String(item.sets), 'sets', 1, 1)}
          {row('Reps mínimas', String(item.repsMin), 'repsMin', 1, 1)}
          {row('Reps máximas', String(item.repsMax), 'repsMax', 1, 1)}
          {row('Descanso', restText(item.rest), 'rest', 15, 15)}
        </div>
        <Info>Cuando hagas todas las series con las reps máximas, la próxima vez te sugiero subir de peso.</Info>
        <div className="two-buttons">
          <button className="secondary" disabled={index === 0} onClick={() => onMove(-1)}>Subir</button>
          <button className="secondary" disabled={index === total - 1} onClick={() => onMove(1)}>Bajar</button>
        </div>
        <button className="link small-link center" onClick={onProgress}>Ver progreso</button>
        <button className="link danger-link" onClick={onDelete}>Quitar de la rutina</button>
      </div>
    </div>
  )
}

// Elegir un ejercicio: recomendados, por músculo o buscando.
export function ExercisePicker({ current, place, injuries = [], onPick, onClose }: { current: RoutineExercise[]; place: Place; injuries?: Injury[]; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const inList = new Set(current.map((x) => x.exerciseId))
  const q = normalize(query.trim())
  const shown = EXERCISES.filter((e) => (all || available(e, place)) && (!muscle || e.muscle === muscle) && (!q || normalize(e.name).includes(q)))
  const recs = !muscle && !q ? recommend(current, place, 4, careOf({ injuries, health: [], level: 'algo' }).exclude) : []
  const row = (e: Exercise) => (
    <button key={e.id} className="routine-row" onClick={() => onPick(e)}>
      <span className="option-text"><b>{e.name}</b><small>{muscleLabel(e.muscle)} · {e.compound ? 'compuesto' : 'aislamiento'}{inList.has(e.id) ? ' · ya está' : ''}{caution(e.id, injuries)}</small></span>
      <span className="add-dot">+</span>
    </button>
  )
  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">Agregar ejercicio</span>
        <span className="spacer" />
      </div>
      <label className="search"><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" /></label>
      <div className="chips muscle-chips">
        <button className={!muscle ? 'chip on' : 'chip'} onClick={() => setMuscle(null)}>Todos</button>
        {MUSCLES.map((m) => <button key={m.id} className={muscle === m.id ? 'chip on' : 'chip'} onClick={() => setMuscle(m.id)}>{m.label}</button>)}
      </div>
      {recs.length > 0 && (
        <div className="chip-group"><h4>Recomendados para esta rutina</h4><div className="card recs">{recs.map(row)}</div></div>
      )}
      <div className="chip-group">
        <h4>{muscle ? muscleLabel(muscle) : 'Todos los ejercicios'}</h4>
        <div className="card recs">{shown.map(row)}{!shown.length && <p className="hint">No encontré ese ejercicio.</p>}</div>
      </div>
      {place !== 'gimnasio' && <button className="link small-link center" onClick={() => setAll(!all)}>{all ? `Solo los que puedo hacer en ${place === 'casa' ? 'casa' : 'peso corporal'}` : 'Ver también los de gimnasio'}</button>}
    </div>
  )
}
