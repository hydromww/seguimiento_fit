// Tu peso: guardarlo, sacar la tendencia y revisar cada 3 semanas si tu meta funciona.
//
// En qué nos basamos (detalle en COMO-FUNCIONA.md):
// - El peso de un día sube y baja hasta 1 kg por agua, sal y comida en el estómago.
//   Por eso miramos la tendencia: un promedio que se mueve poco a poco (media móvil
//   exponencial, la idea de The Hacker's Diet y apps como Happy Scale).
// - El ritmo (kg por semana) sale de una recta ajustada a tus pesadas de las últimas
//   3 semanas: así un día raro no lo cambia.
// - Tu gasto real = lo que comiste en promedio + lo que bajaste (o − lo que subiste)
//   pasado a calorías, con 1 kg ≈ 7.700 kcal.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry, type Weight } from './db'
import { addDays, dayKey, fromKey } from './dates'
import { calculate, PACES, round, saveGoals, upgradeProfile, type Goals } from './goals'
import { fmt } from './nutrition'

export const KCAL_PER_KG = 7700
export const REVIEW_DAYS = 21
const MIN_WEIGHINGS = 8
const MIN_FOOD_DAYS = 14
const MIN_DAY_KCAL = 800 // un día con menos de esto probablemente no se anotó completo
const MAX_CHANGE = 200 // kcal por revisión
const SMOOTHING = 0.2 // cuánto pesa cada pesada nueva en la tendencia (más alto = sigue más rápido)

export const useWeights = () => useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? []

export const saveWeight = (date: string, kg: number) => db.weights.put({ date, kg: round(kg, 0.1), createdAt: Date.now() })
export const deleteWeight = (date: string) => db.weights.delete(date)

export const daysBetween = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000)

export interface TrendPoint { date: string; kg: number; trend: number }

// La tendencia en cada pesada. Arranca con el promedio de las 3 primeras para que
// un primer día raro no la desvíe. Los días sin pesarte la tendencia no cambia.
export function withTrend(weights: Weight[]): TrendPoint[] {
  if (!weights.length) return []
  let t = weights.slice(0, 3).reduce((a, w) => a + w.kg, 0) / Math.min(3, weights.length)
  return weights.map((w) => {
    t += SMOOTHING * (w.kg - t)
    return { date: w.date, kg: w.kg, trend: t }
  })
}

// Recta que mejor pasa por tus pesadas: devuelve kg por día (negativo = bajando).
export function slopePerDay(weights: Weight[]): number {
  if (weights.length < 2) return 0
  const x = weights.map((w) => daysBetween(weights[0].date, w.date))
  const mx = x.reduce((a, b) => a + b, 0) / x.length
  const my = weights.reduce((a, w) => a + w.kg, 0) / weights.length
  let num = 0, den = 0
  weights.forEach((w, i) => { num += (x[i] - mx) * (w.kg - my); den += (x[i] - mx) ** 2 })
  return den ? num / den : 0
}

// Pesadas de un periodo [desde, hasta].
const between = (weights: Weight[], from: string, to: string) => weights.filter((w) => w.date >= from && w.date <= to)

// Cuántos kg por semana espera tu plan (negativo = bajar).
export function plannedRate(goals: Goals | null | undefined): number | undefined {
  const p = goals?.profile
  if (!p || goals?.mode !== 'guiado') return undefined
  const pace = PACES[p.objective]?.[p.pace]
  return pace ? (pace.kcal(p.weight) * 7) / KCAL_PER_KG : 0
}

// Desde cuándo cuenta la revisión: la última vez que cambió tu meta o que revisaste.
export const reviewStart = (goals: Goals) => dayKey(new Date(Math.max(goals.updatedAt, goals.reviewedAt ?? 0)))

export type Review =
  | { ready: false; daysLeft: number; weighings: number; needWeighings: number }
  | {
      ready: true
      from: string
      to: string
      ratePerWeek: number // lo que de verdad pasó
      planned?: number // lo que esperaba tu plan
      change: number // kg en el periodo, según la recta
      foodDays: number
      avgIntake?: number // solo si anotaste suficientes días
      realTdee?: number
      oldTdee: number
      current: number // tu meta diaria de ahora
      proposed: number // la nueva (ya limitada a ±200)
      ideal: number // la que saldría sin el límite
      method: 'gasto' | 'ritmo' // con tus comidas o solo comparando el ritmo
      next?: Goals // las metas nuevas listas para guardar
    }

export function reviewFor(goals: Goals, weights: Weight[], entries: Entry[], today = dayKey()): Review {
  const start = reviewStart(goals)
  const to = addDays(today, -1) // hoy aún no termina
  const from = addDays(today, -REVIEW_DAYS)
  const period = between(weights, from, today)
  const elapsed = daysBetween(start, today)
  if (elapsed < REVIEW_DAYS || period.length < MIN_WEIGHINGS || daysBetween(period[0].date, period[period.length - 1].date) < 14) {
    return { ready: false, daysLeft: Math.max(0, REVIEW_DAYS - elapsed), weighings: period.length, needWeighings: MIN_WEIGHINGS }
  }

  const slope = slopePerDay(period)
  const ratePerWeek = slope * 7
  const planned = plannedRate(goals)

  // Lo que comiste cada día del periodo (solo días anotados de verdad).
  const byDay = new Map<string, number>()
  for (const e of entries) if (e.date >= from && e.date <= to) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.nutrients.kcal)
  const logged = [...byDay.values()].filter((k) => k >= MIN_DAY_KCAL)

  const p = goals.profile && upgradeProfile(goals.profile)
  const calc = p ? calculate(p) : undefined
  const oldTdee = calc ? calc.breakdown.tdee : goals.daily.kcal
  const current = goals.daily.kcal
  let ideal: number
  let avgIntake: number | undefined
  let realTdee: number | undefined
  let method: 'gasto' | 'ritmo'

  if (logged.length >= MIN_FOOD_DAYS) {
    // Con tus comidas: gasto real = lo que comiste + lo que bajaste en calorías.
    method = 'gasto'
    avgIntake = logged.reduce((a, b) => a + b, 0) / logged.length
    realTdee = avgIntake - slope * KCAL_PER_KG
    // A tu gasto real le aplicamos el mismo déficit o superávit de tu plan.
    ideal = realTdee + (calc ? calc.goals.daily.kcal - calc.breakdown.tdee : 0)
  } else {
    // Sin suficientes comidas anotadas: comparamos tu ritmo con el plan, con cautela (la mitad).
    method = 'ritmo'
    const gap = ratePerWeek - (planned ?? 0) // positivo = bajas más lento (o subes más rápido)
    ideal = current - (gap * KCAL_PER_KG) / 7 / 2
  }
  const floor = p?.sex === 'mujer' ? 1200 : 1500
  ideal = Math.max(floor, ideal)
  const proposed = round(Math.max(current - MAX_CHANGE, Math.min(current + MAX_CHANGE, ideal)), 10)

  // Las metas nuevas: recalculamos con tu peso actual y una corrección del gasto
  // que deja la meta en lo propuesto. Así, si luego recalculas, la corrección se mantiene.
  let next: Goals | undefined
  if (p && goals.mode === 'guiado') {
    const trendNow = withTrend(weights).at(-1)?.trend ?? p.weight
    const base = { ...p, weight: round(trendNow, 0.1) }
    const plain = calculate(base).goals.daily.kcal
    const offset = (p.tdeeOffset ?? 0) + (proposed - plain)
    next = { ...calculate({ ...base, tdeeOffset: round(offset, 10) }).goals, reviewedAt: Date.now() }
  }

  return {
    ready: true, from, to, ratePerWeek, planned, change: slope * daysBetween(from, to), foodDays: logged.length,
    avgIntake, realTdee, oldTdee, current, proposed, ideal, method, next,
  }
}

// "Aplicar": guarda las metas nuevas. "Mantener": solo marca que revisaste.
export const applyReview = (next: Goals) => saveGoals(next)
export const keepGoals = (goals: Goals) => saveGoals({ ...goals, reviewedAt: Date.now() })

// Para mostrar: "81,7" y "−0,27".
export const kg = (n: number) => fmt('protein', Math.round(n * 10) / 10)
export const signed = (n: number, digits = 1) => {
  const v = Math.round(n * 10 ** digits) / 10 ** digits
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es', { minimumFractionDigits: digits > 1 ? 2 : 1, maximumFractionDigits: digits })}`
}

// Ritmo de las últimas 3 semanas, en kg por semana.
export function recentRate(weights: Weight[], today = dayKey()) {
  const recent = weights.filter((w) => w.date >= addDays(today, -REVIEW_DAYS))
  return recent.length >= 4 ? slopePerDay(recent) * 7 : undefined
}

// La línea de tu plan arranca en tu tendencia del día en que pusiste la meta.
export function planLine(goals: Goals | null | undefined, weights: Weight[]) {
  const perWeek = plannedRate(goals)
  if (perWeek === undefined || !goals || !weights.length) return undefined
  const start = reviewStart(goals)
  const points = withTrend(weights)
  const at = points.filter((p) => p.date <= start).at(-1) ?? points.find((p) => p.date >= start)
  return at ? { date: start > at.date ? start : at.date, kg: at.trend, perWeek } : undefined
}

