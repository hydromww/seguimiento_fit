// Entrenos: rutinas, el generador de "la mejor rutina para ti", recomendaciones,
// cuándo subir de peso, récords y calorías.
//
// En qué nos basamos (detalle en COMO-FUNCIONA.md):
// - Reparto según cuántos días entrenas: 1–2 días cuerpo completo, 3 empuje/jalón/pierna,
//   4 torso/pierna dos veces, 5 y 6 empuje/jalón/pierna con más volumen. Así cada
//   músculo se trabaja unas 2 veces por semana, lo que más recomienda la evidencia
//   para ganar músculo (Schoenfeld y colegas, 2016).
// - Repeticiones según tu objetivo: fuerza 5–8 en los compuestos; músculo 6–10 y 10–15;
//   perder grasa o salud 8–12 y 12–15 con descansos más cortos.
// - Sobrecarga progresiva "doble": cuando haces todas las series con el máximo de
//   repeticiones, la próxima vez subes un poco de peso.
// - 1RM estimado (el máximo que levantarías una vez) con la fórmula de Epley.
// - Calorías con valores MET del Compendium of Physical Activities.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cardio, type Intensity, type Routine, type RoutineExercise, type Workout, type WorkoutSet } from './db'
import { dayKey } from './dates'
import type { Goals, Objective } from './goals'
import { available, EXERCISES, exerciseById, type Exercise, type Muscle, type Place } from './exercises'
import { NO_CARE, type Care } from './conditions'

export const useRoutines = () => useLiveQuery(() => db.routines.orderBy('createdAt').toArray(), [])
export const useWorkouts = () => useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), [])
export const useCardio = () => useLiveQuery(() => db.cardio.orderBy('date').reverse().toArray(), [])
export const saveRoutine = (r: Routine) => db.routines.put(r) as Promise<number>
export const deleteRoutine = (id: number) => db.routines.delete(id)

// ---------- Plantillas y generador ----------

type Slot = [Muscle, boolean, string[]?] // músculo, si debe ser compuesto y ejercicios preferidos
const C = true, I = false
const SESSIONS: Record<string, Slot[]> = {
  Empuje: [['pecho', C], ['hombro', C], ['pecho', C], ['hombro', I], ['triceps', I], ['pecho', I], ['triceps', I], ['core', I]],
  'Jalón': [['espalda', C], ['espalda', C], ['espalda', C], ['hombro', I, ['face-pull', 'pajaros']], ['biceps', I], ['biceps', I], ['espalda', I], ['core', I]],
  Pierna: [['cuadriceps', C], ['femoral', C], ['cuadriceps', C], ['femoral', I], ['cuadriceps', I], ['pantorrilla', I], ['gluteo', I], ['core', I]],
  Torso: [['pecho', C], ['espalda', C], ['hombro', C], ['espalda', C], ['pecho', I], ['biceps', I], ['triceps', I], ['hombro', I]],
  'Cuerpo completo': [['cuadriceps', C], ['pecho', C], ['espalda', C], ['femoral', C], ['hombro', C], ['biceps', I], ['triceps', I], ['core', I]],
}
export const TEMPLATES = Object.keys(SESSIONS)

function split(n: number, objective: Objective): string[] {
  const light = objective === 'perder' || objective === 'sano' || objective === 'mantener'
  switch (Math.min(6, n)) {
    case 1: return ['Cuerpo completo']
    case 2: return ['Cuerpo completo', 'Cuerpo completo B']
    case 3: return light ? ['Cuerpo completo', 'Cuerpo completo B', 'Cuerpo completo C'] : ['Empuje', 'Jalón', 'Pierna']
    case 4: return ['Torso', 'Pierna', 'Torso B', 'Pierna B']
    case 5: return ['Empuje', 'Jalón', 'Pierna', 'Torso', 'Pierna B']
    default: return ['Empuje', 'Jalón', 'Pierna', 'Empuje B', 'Jalón B', 'Pierna B']
  }
}

// Cómo se reparte tu semana, en palabras.
export function splitText(n: number, objective: Objective) {
  const light = objective === 'perder' || objective === 'sano' || objective === 'mantener'
  if (n <= 2 || (n === 3 && light)) return 'Cuerpo completo cada día: cada músculo se trabaja varias veces por semana.'
  if (n === 3) return 'Empuje (pecho, hombro, tríceps), jalón (espalda, bíceps) y pierna.'
  if (n === 4) return 'Torso y pierna, dos veces cada uno: cada músculo 2 veces por semana.'
  return 'Empuje, jalón y pierna con más volumen: cada músculo unas 2 veces por semana.'
}

// Series, repeticiones y descanso según tu objetivo (y lo que hay que cuidar).
export function dose(e: Exercise, objective: Objective, first: boolean, care: Care = NO_CARE): Omit<RoutineExercise, 'exerciseId'> {
  if (e.id === 'plancha') return { sets: 3, repsMin: 30, repsMax: 60, rest: 60 }
  if (e.bodyweight) return { sets: 3, repsMin: 8, repsMax: 15, rest: 90 }
  // Con presión alta, corazón o embarazo: nada muy pesado y descansos largos.
  const strength = objective === 'rendimiento' && !care.gentle
  const muscle = (objective === 'ganar' || objective === 'recomposicion') && !care.gentle
  // Si estás empezando, el primer compuesto también va a 3 series.
  const sets = first && care.level !== 'nuevo' ? 4 : 3
  if (e.compound) {
    const [repsMin, repsMax] = strength ? [5, 8] : muscle ? [6, 10] : [8, 12]
    return { sets, repsMin, repsMax, rest: strength ? 180 : muscle || care.gentle ? 150 : 120 }
  }
  const [repsMin, repsMax] = strength ? [8, 12] : muscle ? [10, 15] : [12, 15]
  return { sets: 3, repsMin, repsMax, rest: strength ? 90 : muscle || care.gentle ? 90 : 60 }
}

// Si estás empezando: máquinas y poleas primero, son más fáciles de aprender.
const easy = (e: Exercise) => (e.equipment === 'maquina' || e.equipment === 'polea' ? 1 : 0)

// Arma una sesión: para cada hueco, el primer ejercicio del catálogo que sirva y no esté
// repetido. Los que no convienen por una lesión no entran nunca.
export function buildSession(template: string, count: number, place: Place, objective: Objective, avoid = new Set<string>(), care: Care = NO_CARE): RoutineExercise[] {
  const slots = SESSIONS[template.replace(/ [BC]$/, '')] ?? SESSIONS['Cuerpo completo']
  const used = new Set<string>()
  const out: RoutineExercise[] = []
  for (const [muscle, compound, prefer = []] of slots) {
    if (out.length >= count) break
    const fits = EXERCISES.filter((e) => e.muscle === muscle && available(e, place) && !used.has(e.id) && !care.exclude.has(e.id))
      .sort((a, b) => Number(prefer.includes(b.id)) - Number(prefer.includes(a.id)) || (care.level === 'nuevo' ? easy(b) - easy(a) : 0))
    const same = fits.filter((x) => x.compound === compound)
    const e = same.find((x) => !avoid.has(x.id)) ?? same[0] ?? fits.find((x) => !avoid.has(x.id)) ?? fits[0]
    if (!e) continue
    used.add(e.id)
    out.push({ exerciseId: e.id, ...dose(e, objective, out.filter((x) => exerciseById.get(x.exerciseId)?.compound).length < 2 && e.compound, care) })
  }
  return out
}

export interface GenOptions {
  days: number[]
  minutes: number
  place: Place
  objective: Objective
  care?: Care
}

// Cuántos ejercicios caben: unos 9 minutos cada uno (series, descansos y cambiar de máquina).
export const exercisesFor = (minutes: number) => Math.max(4, Math.min(8, Math.round((minutes - 5) / 9)))

// "La mejor rutina para ti" según tus días de pesas, minutos, objetivo y dónde entrenas.
export function generate(o: GenOptions): Omit<Routine, 'id'>[] {
  const days = [...o.days].sort().slice(0, 6)
  const names = split(days.length, o.objective)
  const usedBy = new Map<string, Set<string>>() // por plantilla, para que la B use otros ejercicios
  return names.map((name, i) => {
    const base = name.replace(/ [BC]$/, '')
    const avoid = usedBy.get(base) ?? new Set<string>()
    const care = o.care ?? NO_CARE
    const count = exercisesFor(o.minutes) - (care.level === 'nuevo' && o.minutes > 40 ? 1 : 0)
    const exercises = buildSession(name, count, o.place, o.objective, avoid, care)
    for (const x of exercises) avoid.add(x.exerciseId)
    usedBy.set(base, avoid)
    return { name, days: [days[i]], exercises, createdAt: Date.now() + i }
  })
}

// Reemplaza tus rutinas por las generadas (quedan tus entrenos pasados).
export async function replaceRoutines(routines: Omit<Routine, 'id'>[]) {
  await db.transaction('rw', db.routines, async () => {
    await db.routines.clear()
    await db.routines.bulkAdd(routines)
  })
}

// ---------- Recomendaciones al armar una rutina ----------

const PARTNERS: Partial<Record<Muscle, Muscle[]>> = {
  pecho: ['triceps', 'hombro'], espalda: ['biceps', 'hombro'], hombro: ['triceps'],
  cuadriceps: ['femoral', 'gluteo', 'pantorrilla'], femoral: ['gluteo', 'cuadriceps'], gluteo: ['femoral'],
}

// Lo que más le falta a la rutina: músculos que ya trabaja con pocos ejercicios y sus
// compañeros naturales (pecho → tríceps, espalda → bíceps, cuádriceps → femoral).
export function recommend(exercises: RoutineExercise[], place: Place, limit = 6, exclude = new Set<string>()): Exercise[] {
  const inRoutine = new Set(exercises.map((x) => x.exerciseId))
  const count = new Map<Muscle, number>()
  const hasCompound = new Set<Muscle>()
  for (const x of exercises) {
    const e = exerciseById.get(x.exerciseId)
    if (!e) continue
    count.set(e.muscle, (count.get(e.muscle) ?? 0) + 1)
    if (e.compound) hasCompound.add(e.muscle)
  }
  const score = (m: Muscle) => {
    if (!count.size) return ['pecho', 'espalda', 'cuadriceps'].includes(m) ? 3 : 1
    let s = count.has(m) ? 2 : 0
    for (const [k] of count) if (PARTNERS[k]?.includes(m)) s += 1.5
    return s - (count.get(m) ?? 0) * 1.2
  }
  return EXERCISES.filter((e) => !inRoutine.has(e.id) && available(e, place) && !exclude.has(e.id))
    .map((e) => ({ e, s: score(e.muscle) + (e.compound && !hasCompound.has(e.muscle) ? 1 : 0) - EXERCISES.indexOf(e) * 0.001 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .reduce<Exercise[]>((acc, { e }) => (acc.filter((x) => x.muscle === e.muscle).length < 2 ? [...acc, e] : acc), [])
    .slice(0, limit)
}

// ---------- Durante el entreno ----------

export const epley = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))

// Las series de la última vez que hiciste ese ejercicio (antes del entreno `skip`).
export function lastSets(workouts: Workout[], exerciseId: string, skip?: number): WorkoutSet[] {
  const w = workouts.filter((x) => x.endedAt && x.id !== skip && x.sets.some((s) => s.exerciseId === exerciseId && s.done)).sort((a, b) => b.startedAt - a.startedAt)[0]
  return w ? w.sets.filter((s) => s.exerciseId === exerciseId && s.done) : []
}

// Cuánto peso usar hoy: si la última vez hiciste todas las series con el máximo, subes.
export function suggestKg(last: WorkoutSet[], plan: RoutineExercise): { kg: number; up: boolean } {
  const e = exerciseById.get(plan.exerciseId)
  if (!last.length || e?.bodyweight) return { kg: last.length ? Math.max(...last.map((s) => s.kg)) : 0, up: false }
  const top = Math.max(...last.map((s) => s.kg))
  const work = last.filter((s) => s.kg === top)
  const up = work.length >= plan.sets && work.every((s) => s.reps >= plan.repsMax)
  return { kg: up ? top + (e?.step ?? 2.5) : top, up }
}

// Arranca un entreno con las series ya armadas (peso sugerido y reps de la última vez).
export async function startWorkout(routine: Routine | null, workouts: Workout[]): Promise<number> {
  const plan = routine?.exercises ?? []
  const sets: WorkoutSet[] = plan.flatMap((p) => {
    const last = lastSets(workouts, p.exerciseId)
    const { kg } = suggestKg(last, p)
    return Array.from({ length: p.sets }, (_, i) => ({ exerciseId: p.exerciseId, kg, reps: last[i]?.reps ?? p.repsMin, done: false }))
  })
  return (await db.workouts.add({ date: dayKey(), routineId: routine?.id, name: routine?.name ?? 'Entreno libre', plan, sets, startedAt: Date.now() })) as number
}

export const saveWorkout = (w: Workout) => db.workouts.put(w)

// Los ejercicios del entreno en orden, con sus series.
export function groups(w: Workout) {
  const order: string[] = []
  for (const p of w.plan) order.push(p.exerciseId)
  for (const s of w.sets) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)
  return order.map((exerciseId) => ({
    exerciseId,
    plan: w.plan.find((p) => p.exerciseId === exerciseId),
    sets: w.sets.map((s, index) => ({ s, index })).filter((x) => x.s.exerciseId === exerciseId),
  }))
}

// ---------- Resumen, récords y progreso ----------

export const volumeOf = (sets: WorkoutSet[]) => sets.filter((s) => s.done).reduce((a, s) => a + s.kg * s.reps, 0)

export interface PR { exerciseId: string; kg: number; reps: number; before?: { kg: number; reps: number } }

// Récords: series de hoy cuyo 1RM estimado supera todo lo anterior.
export function recordsOf(w: Workout, workouts: Workout[]): PR[] {
  const before = workouts.filter((x) => x.endedAt && x.id !== w.id && x.startedAt < w.startedAt)
  const out: PR[] = []
  for (const g of groups(w)) {
    const done = g.sets.map((x) => x.s).filter((s) => s.done && s.kg > 0)
    if (!done.length) continue
    const best = done.reduce((a, s) => (epley(s.kg, s.reps) > epley(a.kg, a.reps) ? s : a))
    const prev = before.flatMap((x) => x.sets.filter((s) => s.exerciseId === g.exerciseId && s.done && s.kg > 0))
    if (!prev.length) continue // la primera vez no cuenta como récord
    const prevBest = prev.reduce((a, s) => (epley(s.kg, s.reps) > epley(a.kg, a.reps) ? s : a))
    if (epley(best.kg, best.reps) > epley(prevBest.kg, prevBest.reps) + 0.01) out.push({ exerciseId: g.exerciseId, kg: best.kg, reps: best.reps, before: { kg: prevBest.kg, reps: prevBest.reps } })
  }
  return out
}

// El historial de un ejercicio: mejor serie por día.
export function historyOf(workouts: Workout[], exerciseId: string) {
  return workouts.filter((w) => w.endedAt).map((w) => {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId && s.done)
    if (!sets.length) return null
    const best = sets.reduce((a, s) => (s.kg > a.kg || (s.kg === a.kg && s.reps > a.reps) ? s : a))
    return { date: w.date, startedAt: w.startedAt, sets, best, e1rm: Math.max(...sets.map((s) => epley(s.kg, s.reps))) }
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.startedAt - b.startedAt)
}

// ---------- Calorías ----------

export const CARDIO_TYPES: { id: string; label: string; met: [number, number, number] }[] = [
  { id: 'caminar', label: 'Caminar', met: [3.5, 4.3, 5] },
  { id: 'correr', label: 'Correr', met: [7, 9.8, 11.5] },
  { id: 'bicicleta', label: 'Bicicleta', met: [5.5, 7.5, 10] },
  { id: 'eliptica', label: 'Elíptica', met: [4.5, 5.5, 7] },
  { id: 'escaladora', label: 'Escaladora', met: [6, 8, 9] },
  { id: 'natacion', label: 'Natación', met: [5.8, 8, 10] },
  { id: 'clase', label: 'Clase / baile', met: [4.5, 6, 7.5] },
]
const LEVEL: Record<Intensity, number> = { suave: 0, moderado: 1, fuerte: 2 }

// kcal ≈ MET × kg × horas (le restamos 1 MET: lo que gastarías igual sentado).
export const cardioKcal = (type: string, intensity: Intensity, minutes: number, bodyKg: number) =>
  Math.round(((CARDIO_TYPES.find((t) => t.id === type)?.met[LEVEL[intensity]] ?? 5) - 1) * bodyKg * (minutes / 60))
export const weightsKcal = (minutes: number, bodyKg: number) => Math.round((5 - 1) * bodyKg * (Math.min(120, minutes) / 60))

export async function bodyKg(): Promise<number> {
  const last = await db.weights.orderBy('date').last()
  if (last) return last.kg
  const goals = (await db.settings.get('goals'))?.value as Goals | undefined
  return goals?.profile?.weight ?? 70
}

export const saveCardio = (c: Cardio) => db.cardio.put(c)

// Lo que toca hoy según tus metas: pesas, cardio, los dos o descanso.
export function plannedFor(goals: Goals | null | undefined, weekday: number) {
  const p = goals?.profile
  return { weights: !!p?.weightsDays.includes(weekday), cardio: !!p?.cardioDays.includes(weekday) }
}

export const minutesLabel = (ms: number) => {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// Lo que recuerda la app de cómo entrenas.
export interface TrainingPrefs { place: Place }
const DEFAULT_TRAINING: TrainingPrefs = { place: 'gimnasio' }
export const useTrainingPrefs = () =>
  useLiveQuery(async () => ({ ...DEFAULT_TRAINING, ...(((await db.settings.get('training'))?.value as Partial<TrainingPrefs> | undefined) ?? {}) }), [])
export const saveTrainingPrefs = (p: TrainingPrefs) => db.settings.put({ key: 'training', value: p })

// "1,5" o "1.5" → 1.5
export const parseNum = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}
export const kgText = (kg: number) => String(Math.round(kg * 100) / 100).replace('.', ',')

export const restText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`)
export const targetText = (x: RoutineExercise) => `${x.sets} series · ${x.repsMin === x.repsMax ? x.repsMin : `${x.repsMin} a ${x.repsMax}`} ${x.exerciseId === 'plancha' ? 's' : 'reps'}`

// Cambia un entreno leyendo siempre la última versión guardada (así dos toques
// seguidos, como escribir las reps y marcar la serie, no se pisan).
export const patchWorkout = (id: number, fn: (w: Workout) => Workout) =>
  db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id)
    if (w) await db.workouts.put(fn(w))
  })
