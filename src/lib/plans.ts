// Planes de comida: guardarlos, asignarlos a los días de la semana y pasarlos a tu diario.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food, type Plan, type PlanItem } from './db'
import { fromKey } from './dates'
import { addEntry, entryPer100g } from './diary'
import type { Goals } from './goals'
import { goalKinds } from './goals'
import type { Exclusion } from './pantry'
import type { Meal } from './db'

export const usePlans = () => useLiveQuery(() => db.plans.orderBy('createdAt').toArray(), [])

// Qué plan va cada día: posición 0 = lunes … 6 = domingo; null = ninguno.
export type PlanWeek = (number | null)[]
const EMPTY_WEEK: PlanWeek = [null, null, null, null, null, null, null]

export const usePlanWeek = () =>
  useLiveQuery(async () => ((await db.settings.get('planWeek'))?.value as PlanWeek | undefined) ?? EMPTY_WEEK, []) ?? EMPTY_WEEK
export const savePlanWeek = (week: PlanWeek) => db.settings.put({ key: 'planWeek', value: week })

// Guarda un plan. Si es nuevo, lo pone en los días de su tipo que aún no tengan plan.
export async function savePlan(plan: Plan, goals?: Goals | null): Promise<number> {
  const isNew = !plan.id
  const id = (await db.plans.put(plan)) as number // ojo: Dexie le pone el id al objeto
  if (isNew) {
    const week = [...(((await db.settings.get('planWeek'))?.value as PlanWeek | undefined) ?? EMPTY_WEEK)]
    const kind = goalKinds(goals).find((k) => k.label === plan.kind)
    const days = kind ? kind.days : [0, 1, 2, 3, 4, 5, 6]
    let changed = false
    for (const d of days) if (week[d] == null) { week[d] = id; changed = true }
    if (changed) await savePlanWeek(week)
  }
  return id
}

export async function deletePlan(id: number) {
  await db.plans.delete(id)
  const week = ((await db.settings.get('planWeek'))?.value as PlanWeek | undefined) ?? EMPTY_WEEK
  await savePlanWeek(week.map((p) => (p === id ? null : p)))
}

// "Día de pesas", "Día de descanso", "Mi plan"
export const planNameFor = (kind: string) => (kind === 'Todos los días' ? 'Mi plan' : kind.startsWith('Día') ? kind : `Día de ${kind.toLowerCase()}`)

export const weekdayOf = (date: string) => (fromKey(date).getDay() + 6) % 7

// La meta con la que se compara un plan.
export function goalForPlan(plan: Pick<Plan, 'kind'>, goals: Goals | null | undefined) {
  const kinds = goalKinds(goals)
  return (kinds.find((k) => k.label === plan.kind) ?? kinds[0])?.goal
}

// Un alimento del plan convertido en "ficha" para poder registrarlo en el diario.
export function itemToFood(item: PlanItem): Food | Omit<Food, 'id'> {
  const base = {
    name: item.name,
    source: item.icbfCode ? ('icbf' as const) : ('propio' as const),
    icbfCode: item.icbfCode,
    per100g: item.per100g,
    portionName: item.unitName ? `1 ${item.unitName}` : '100 g',
    portionGrams: item.unitGrams ?? 100,
    favorite: false,
    createdAt: Date.now(),
  }
  return item.foodId ? { ...base, id: item.foodId } : base
}

export async function addItemsToDay(items: PlanItem[], date: string) {
  for (const it of items) await addEntry(itemToFood(it), it.grams, date, it.meal)
}

// "Copiar un día que ya comí": lo que registraste ese día, como alimentos de un plan.
export async function itemsFromDay(date: string): Promise<PlanItem[]> {
  const entries = await db.entries.where('date').equals(date).sortBy('createdAt')
  const foods = new Map((await db.foods.bulkGet(entries.map((e) => e.foodId))).filter((f): f is Food => !!f).map((f) => [f.id!, f]))
  return entries.map((e) => {
    const f = foods.get(e.foodId)
    return {
      meal: e.meal, name: e.name, grams: e.grams, per100g: entryPer100g(e), foodId: e.foodId,
      ...(f?.icbfCode ? { icbfCode: f.icbfCode } : {}),
    }
  })
}

// Lo que recuerda el asistente para la próxima vez.
export interface PlannerPrefs {
  selected: string[] // claves de la despensa: código ICBF o "f<id>" para tus alimentos
  favorites: string[]
  exclusions: Exclusion[]
  meals: Meal[]
  evenProtein: boolean
}
export const DEFAULT_PREFS: PlannerPrefs = { selected: [], favorites: [], exclusions: [], meals: ['desayuno', 'almuerzo', 'snack', 'cena'], evenProtein: true }
export const loadPrefs = async () => ({ ...DEFAULT_PREFS, ...(((await db.settings.get('planner'))?.value as Partial<PlannerPrefs> | undefined) ?? {}) })
export const savePrefs = (prefs: PlannerPrefs) => db.settings.put({ key: 'planner', value: prefs })
