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
export type Training = 'pesas' | 'cardio' | 'mixto'
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
  trainingDays: number
  training: Training
  sessionMinutes: number
  steps: number
  pace: number // índice en PACES[objetivo]
  style: Style
  proteinPerKg?: number // solo en "personalizado"
  fatPerKg?: number
  dayMode: DayMode
  highDays: number[] // 0 = lunes … 6 = domingo
}

// Las metas que se guardan. Las de días "altos" (entreno o los que elijas) son opcionales.
export interface Goals {
  mode: 'guiado' | 'manual'
  daily: Nutrients // el promedio, o la meta de todos los días
  high?: Nutrients
  low?: Nutrients
  highDays: number[]
  profile?: Profile
  updatedAt: number
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
const NET_MET: Record<Training, number> = { pesas: 4, cardio: 6, mixto: 5 } // MET − 1 (el reposo ya está contado)
const PROTEIN: Record<Objective, number> = { perder: 2.0, recomposicion: 2.0, ganar: 1.8, mantener: 1.6, rendimiento: 1.6, sano: 1.2 }
const FAT_SHARE: Record<Exclude<Style, 'personalizado'>, number> = { balanceado: 0.27, 'alto-carbos': 0.22, 'bajo-carbos': 0.4 }

export interface Breakdown {
  bmr: number
  bmrFormula: string
  base: number
  steps: number
  exercise: number // promedio por día
  session: number // lo que gasta un entreno
  tdee: number
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
  const session = NET_MET[p.training] * p.weight * (p.sessionMinutes / 60)
  const exercise = (session * p.trainingDays) / 7
  const tdee = base + steps + exercise

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
  const days = p.dayMode === 'igual' ? [] : p.highDays
  const delta = p.dayMode === 'entreno' ? session : 300
  const goals: Goals = { mode: 'guiado', daily, highDays: days, profile: p, updatedAt: Date.now(), ...splitDays(daily, days, delta) }
  return {
    goals,
    breakdown: {
      bmr, bmrFormula: p.bodyFat ? 'Katch-McArdle' : 'Mifflin-St Jeor', base, steps, exercise, session, tdee,
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

// La meta de un día concreto.
export function goalFor(goals: Goals | undefined, date: string): Nutrients | undefined {
  if (!goals) return undefined
  if (!goals.high || !goals.low) return goals.daily
  const weekday = (fromKey(date).getDay() + 6) % 7
  return goals.highDays.includes(weekday) ? goals.high : goals.low
}

export function isHighDay(goals: Goals | undefined, date: string): boolean {
  return !!goals?.high && goals.highDays.includes((fromKey(date).getDay() + 6) % 7)
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
  trainingDays: 3, training: 'pesas', sessionMinutes: 60, steps: 6000, pace: 1,
  style: 'balanceado', dayMode: 'igual', highDays: [0, 2, 4],
}
