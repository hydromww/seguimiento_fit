// Tus metas de calorías y macros: cómo se calculan y cómo se guardan.
//
// En qué nos basamos (detalle en COMO-FUNCIONA.md):
// - Gasto en reposo: Mifflin-St Jeor (1990). Si sabes tu % de grasa, Katch-McArdle.
// - Actividad: factor por tu trabajo + pasos + entrenos (Compendio de Actividades
//   Físicas, valores MET).
// - Objetivo: 1 kg de grasa ≈ 7.700 kcal. Máximo 1 % de tu peso por semana y nunca
//   menos de 1.500 kcal (hombres) o 1.200 kcal (mujeres).
// - Proteína 1,2–2,0 g/kg según objetivo (ISSN 2017; Morton 2018; Helms 2014).
// - Grasa 20–40 % de las calorías y mínimo 0,6 g/kg. Carbohidratos: el resto.
// - Fibra 14 g por cada 1.000 kcal (IOM). Sodio máx. 2.000 mg y azúcar máx. 10 % (OMS).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Nutrients } from './db'
import { fromKey } from './dates'

export type Objective = 'perder' | 'recomposicion' | 'ganar' | 'mantener' | 'rendimiento' | 'sano'
export type Sex = 'hombre' | 'mujer'
export type Job = 'sentado' | 'de-pie' | 'fisico'
export type Style = 'balanceado' | 'alto-carbos' | 'bajo-carbos' | 'personalizado'
export type DayMode = 'igual' | 'entreno' | 'semana'

// Lo que respondes en el asistente.
export interface Profile {
  objective: Objective
  sex: Sex
  age: number
  height: number // cm
  weight: number // kg
  targetWeight?: number
  bodyFat?: number // %
  job: Job
  weightsDays: number[] // días de pesas (0 = lunes … 6 = domingo)
  weightsMinutes: number
  cardioDays: number[] // días de cardio; un día puede tener los dos
  cardioMinutes: number
  steps: number
  pace: number // índice en PACES[objetivo]
  style: Style
  proteinPerKg?: number // solo en "personalizado"
  fatPerKg?: number
  dayMode: DayMode
  highDays: number[] // 0 = lunes … 6 = domingo
  tdeeOffset?: number // corrección del gasto aprendida de tu peso real (revisiones)
}

// Las metas que se guardan. Las de días "altos" (entreno o los que elijas) son opcionales.
export interface Goals {
  mode: 'guiado' | 'manual'
  daily: Nutrients // el promedio, o la meta de todos los días
  high?: Nutrients
  low?: Nutrients
  highDays: number[]
  week?: Nutrients[] // una meta por día (lunes a domingo), según tus entrenos
  profile?: Profile
  updatedAt: number
  reviewedAt?: number // última revisión de peso (aplicada o no)
}

export const OBJECTIVES: { id: Objective; label: string; detail: string }[] = [
  { id: 'perder', label: 'Perder grasa', detail: 'Comer un poco menos de lo que gastas, cuidando el músculo.' },
  { id: 'recomposicion', label: 'Recomposición', detail: 'Bajar grasa y ganar músculo a la vez. Ideal si estás empezando a entrenar.' },
  { id: 'ganar', label: 'Ganar músculo', detail: 'Comer un poco más de lo que gastas, con mucha proteína.' },
  { id: 'mantener', label: 'Mantener mi peso', detail: 'Comer lo que gastas y mejorar tu alimentación.' },
  { id: 'rendimiento', label: 'Rendimiento deportivo', detail: 'Más energía y carbohidratos para entrenar o competir.' },
  { id: 'sano', label: 'Comer más sano', detail: 'Sin tanta exigencia: metas suaves de proteína, fibra y azúcar.' },
]

// Ritmos posibles según el objetivo. Para perder: kg por semana. Para ganar: kcal de más.
export const PACES: Partial<Record<Objective, { label: string; sub: string; kcal: (w: number) => number }[]>> = {
  perder: [0.25, 0.5, 0.75, 1].map((kg, i) => ({
    label: `${String(kg).replace('.', ',')} kg`,
    sub: ['Suave', 'Recomendado', 'Rápido', 'Exigente'][i],
    // 7.700 kcal por kilo, repartidas en 7 días; nunca más del 1 % del peso por semana.
    kcal: (w: number) => -(Math.min(kg, w * 0.01) * 7700) / 7,
  })),
  recomposicion: [
    { label: 'Suave', sub: '−150 kcal', kcal: () => -150 },
    { label: 'Moderado', sub: '−300 kcal', kcal: () => -300 },
  ],
  ganar: [
    { label: 'Suave', sub: '+200 kcal', kcal: () => 200 },
    { label: 'Moderado', sub: '+300 kcal', kcal: () => 300 },
    { label: 'Rápido', sub: '+450 kcal', kcal: () => 450 },
  ],
}
export const DEFAULT_PACE: Partial<Record<Objective, number>> = { perder: 1, recomposicion: 1, ganar: 1 }

const JOB_FACTOR: Record<Job, number> = { sentado: 1.3, 'de-pie': 1.45, fisico: 1.65 }
// MET − 1 (el reposo ya está contado): pesas 5 y cardio moderado 7 en el Compendio.
const NET_MET = { pesas: 4, cardio: 6 }
const PROTEIN: Record<Objective, number> = { perder: 2.0, recomposicion: 2.0, ganar: 1.8, mantener: 1.6, rendimiento: 1.6, sano: 1.2 }
const FAT_SHARE: Record<Exclude<Style, 'personalizado'>, number> = { balanceado: 0.27, 'alto-carbos': 0.22, 'bajo-carbos': 0.4 }

export interface Breakdown {
  bmr: number
  bmrFormula: string
  base: number
  steps: number
  exercise: number // promedio por día
  weightsSession: number // lo que gasta un entreno de pesas
  cardioSession: number // lo que gasta uno de cardio
  tdee: number
  learned: number // corrección por tus datos reales (0 si aún no hay revisión)
  adjustment: number
  floorApplied: boolean
  refWeight: number
  proteinPerKg: number
}

export const round = (n: number, to = 1) => Math.round(n / to) * to

export function calculate(p: Profile): { goals: Goals; breakdown: Breakdown } {
  const lean = p.bodyFat ? p.weight * (1 - p.bodyFat / 100) : 0
  const bmr = p.bodyFat
    ? 370 + 21.6 * lean
    : 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'hombre' ? 5 : -161)
  const base = bmr * JOB_FACTOR[p.job]
  // Pasos por encima de los 4.000 de cualquier día: unas 0,5 kcal por kilo cada 1.000 pasos.
  const steps = Math.max(0, p.steps - 4000) * 0.0005 * p.weight
  const weightsSession = NET_MET.pesas * p.weight * (p.weightsMinutes / 60)
  const cardioSession = NET_MET.cardio * p.weight * (p.cardioMinutes / 60)
  // Lo que gastas entrenando cada día de la semana.
  const perDay = Array.from({ length: 7 }, (_, d) =>
    (p.weightsDays.includes(d) ? weightsSession : 0) + (p.cardioDays.includes(d) ? cardioSession : 0))
  const exercise = perDay.reduce((a, b) => a + b, 0) / 7
  const learned = p.tdeeOffset ?? 0
  const tdee = base + steps + exercise + learned

  const pace = PACES[p.objective]?.[p.pace]
  const adjustment = pace ? pace.kcal(p.weight) : 0
  const floor = p.sex === 'hombre' ? 1500 : 1200
  const kcal = Math.max(floor, tdee + adjustment)

  // Con sobrepeso, la proteína se calcula con un peso de referencia para no inflarla.
  const bmi = p.weight / (p.height / 100) ** 2
  const refWeight = bmi > 27 ? Math.max(p.targetWeight ?? 0, 25 * (p.height / 100) ** 2) : p.weight
  const proteinPerKg = p.style === 'personalizado' && p.proteinPerKg ? p.proteinPerKg : PROTEIN[p.objective]
  const protein = proteinPerKg * refWeight
  let fat = p.style === 'personalizado' && p.fatPerKg
    ? p.fatPerKg * refWeight
    : Math.max(0.6 * refWeight, (kcal * FAT_SHARE[p.style === 'personalizado' ? 'balanceado' : p.style]) / 9)
  let carbs = (kcal - protein * 4 - fat * 9) / 4
  // Para rendimiento, al menos 5 g/kg de carbohidratos (ACSM): se los quitamos a la grasa.
  if (p.objective === 'rendimiento' && carbs < 5 * p.weight) {
    const minFat = 0.6 * refWeight
    const need = (5 * p.weight - carbs) * 4
    const take = Math.min(need, (fat - minFat) * 9)
    fat -= take / 9
    carbs += take / 4
  }
  carbs = Math.max(0, carbs)

  const daily = finish(kcal, protein, carbs, fat)
  const goals: Goals = { mode: 'guiado', daily, highDays: [], profile: p, updatedAt: Date.now() }
  if (p.dayMode === 'entreno') {
    goals.week = splitWeek(daily, perDay)
    goals.highDays = trainingDays(p)
  } else if (p.dayMode === 'semana') {
    Object.assign(goals, splitDays(daily, p.highDays, 300))
    goals.highDays = p.highDays
  }
  return {
    goals,
    breakdown: {
      bmr, bmrFormula: p.bodyFat ? 'Katch-McArdle' : 'Mifflin-St Jeor', base, steps, exercise, weightsSession, cardioSession, tdee, learned,
      adjustment: kcal - tdee, floorApplied: kcal === floor && tdee + adjustment < floor, refWeight, proteinPerKg,
    },
  }
}

// Redondea y añade las otras metas (fibra, azúcar, sodio).
export function finish(kcal: number, protein: number, carbs: number, fat: number, extra?: Partial<Nutrients>): Nutrients {
  return {
    kcal: round(kcal, 10),
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
    fiber: extra?.fiber ?? round((kcal / 1000) * 14),
    sugar: extra?.sugar ?? round((kcal * 0.1) / 4),
    sodium: extra?.sodium ?? 2000,
  }
}

// Días "altos" (entreno o los que elijas) y "bajos", con el mismo promedio semanal.
// La diferencia va toda en carbohidratos; la proteína y la grasa no cambian.
export function splitDays(daily: Nutrients, highDays: number[], delta: number): Pick<Goals, 'high' | 'low'> {
  const n = highDays.length
  if (n === 0 || n === 7 || delta <= 0) return {}
  const lowKcal = daily.kcal - (delta * n) / 7
  const highKcal = lowKcal + delta
  const at = (k: number) => ({ ...daily, kcal: round(k, 10), carbs: Math.max(0, round(daily.carbs + (k - daily.kcal) / 4)) })
  return { high: at(highKcal), low: at(lowKcal) }
}

// Una meta por día según lo que gastas entrenando ese día, con el mismo promedio semanal.
// Igual que arriba, la diferencia va en carbohidratos.
export function splitWeek(daily: Nutrients, perDay: number[]): Nutrients[] | undefined {
  const avg = perDay.reduce((a, b) => a + b, 0) / 7
  if (avg === 0 || perDay.every((k) => k === perDay[0])) return undefined
  return perDay.map((k) => {
    const kcal = daily.kcal - avg + k
    return { ...daily, kcal: round(kcal, 10), carbs: Math.max(0, round(daily.carbs + (kcal - daily.kcal) / 4)) }
  })
}

export const trainingDays = (p: Profile) => [...new Set([...p.weightsDays, ...p.cardioDays])].sort()

const weekdayOf = (date: string) => (fromKey(date).getDay() + 6) % 7

// La meta de un día concreto.
export function goalFor(goals: Goals | undefined, date: string): Nutrients | undefined {
  if (!goals) return undefined
  if (goals.week) return goals.week[weekdayOf(date)]
  if (!goals.high || !goals.low) return goals.daily
  return goals.highDays.includes(weekdayOf(date)) ? goals.high : goals.low
}

// Qué tipo de día es: "pesas", "cardio", "pesas y cardio", "descanso"…
function dayKind(goals: Goals, weekday: number): string {
  const p = goals.profile
  if (goals.week && p) {
    const w = p.weightsDays.includes(weekday), c = p.cardioDays.includes(weekday)
    return w && c ? 'Pesas y cardio' : w ? 'Pesas' : c ? 'Cardio' : 'Descanso'
  }
  const high = goals.highDays.includes(weekday)
  if (p?.dayMode === 'semana') return high ? 'Día alto' : 'Día normal'
  return high ? 'Entreno' : 'Descanso'
}

// La etiqueta del medidor en Hoy (solo si ese día tiene una meta distinta).
export function dayNote(goals: Goals | undefined, date: string): string | undefined {
  if (!goals || (!goals.week && !goals.high)) return undefined
  const kind = dayKind(goals, weekdayOf(date))
  return kind.startsWith('Día') ? kind : `Día de ${kind.toLowerCase()}`
}

// Las metas distintas de la semana, agrupadas: [{ label: 'Pesas', kcal: 2250, days: [0, 3] }, …]
export function weekSummary(goals: Goals): { label: string; kcal: number; days: number[] }[] {
  if (!goals.week && !(goals.high && goals.low)) return []
  const groups = new Map<string, { label: string; kcal: number; days: number[] }>()
  for (let d = 0; d < 7; d++) {
    const label = dayKind(goals, d)
    const kcal = goals.week ? goals.week[d].kcal : goals.highDays.includes(d) ? goals.high!.kcal : goals.low!.kcal
    const g = groups.get(label) ?? { label, kcal, days: [] }
    g.days.push(d)
    groups.set(label, g)
  }
  return [...groups.values()].sort((a, b) => b.kcal - a.kcal)
}

// Perfiles guardados antes de separar pesas y cardio: los convertimos al formato nuevo.
type OldProfile = Partial<Profile> & { trainingDays?: number; training?: 'pesas' | 'cardio' | 'mixto'; sessionMinutes?: number }
const SPREAD = [[], [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]]
export function upgradeProfile(old: Profile | OldProfile): Profile {
  if ('weightsDays' in old && old.weightsDays) return old as Profile
  const o = old as OldProfile
  const days = SPREAD[Math.min(7, Math.max(0, o.trainingDays ?? 0))]
  const minutes = o.sessionMinutes ?? 60
  const weightsDays = o.training === 'cardio' ? [] : o.training === 'mixto' ? days.filter((_, i) => i % 2 === 0) : days
  const cardioDays = o.training === 'cardio' ? days : o.training === 'mixto' ? days.filter((_, i) => i % 2 === 1) : []
  const { trainingDays: _a, training: _b, sessionMinutes: _c, ...rest } = o
  return { ...DEFAULT_PROFILE, ...rest, weightsDays, cardioDays, weightsMinutes: minutes, cardioMinutes: minutes }
}

export const saveGoals = (goals: Goals) => db.settings.put({ key: 'goals', value: goals })
export const deleteGoals = () => db.settings.delete('goals')

// Hook para leer tus metas desde cualquier pantalla (se actualiza solo).
export function useGoals(): Goals | undefined | null {
  // undefined = cargando, null = aún no tienes metas
  return useLiveQuery(async () => ((await db.settings.get('goals'))?.value as Goals | undefined) ?? null, [])
}

export const DEFAULT_PROFILE: Profile = {
  objective: 'perder', sex: 'hombre', age: 30, height: 170, weight: 70, job: 'sentado',
  weightsDays: [0, 2, 4], weightsMinutes: 60, cardioDays: [], cardioMinutes: 40, steps: 6000, pace: 1,
  style: 'balanceado', dayMode: 'igual', highDays: [0, 2, 4],
}
