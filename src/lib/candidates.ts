// Los alimentos con los que el asistente arma planes y menús: lo que marcaste en
// "¿Qué tienes en casa?", con tus favoritos y sin lo que no comes.
import { db, type Food, type PlanItem } from './db'
import { frequentFoodIds } from './diary'
import { icbfByCodes, normalize } from './icbf'
import { EXCLUSIONS, PANTRY } from './pantry'
import { roleOf, type AnyFood, type Candidate } from './planner'
import type { PlannerPrefs } from './plans'

export const PANTRY_UNITS = new Map(PANTRY.flatMap((g) => g.items).map((i) => [i.code, i]))

// La "clave" de un alimento: su código ICBF, "f<id>" si es tuyo, o su nombre.
export const keyOf = (f: Pick<AnyFood, 'icbfCode' | 'name'> & { id?: number }) => f.icbfCode ?? (f.id ? `f${f.id}` : normalize(f.name))
export const keyOfItem = (it: PlanItem) => keyOf({ icbfCode: it.icbfCode, id: it.foodId, name: it.name })

export const labelOf = (key: string, f: AnyFood) => PANTRY_UNITS.get(key)?.label ?? f.name

// Si nunca has usado el asistente y casi no has registrado nada, empezamos con lo típico.
const STARTER = ['J003', 'F086', 'F104', 'E004', 'A009', 'A005', 'B067', 'A012', 'T010', 'C010', 'B103', 'B059', 'C001']

export function makeCandidates(selected: Iterable<string>, all: Map<string, AnyFood>, prefs: Pick<PlannerPrefs, 'favorites' | 'exclusions'>): Candidate[] {
  const favorites = new Set(prefs.favorites)
  const exclusions = new Set<string>(prefs.exclusions)
  return [...selected].flatMap((key) => {
    const f = all.get(key)
    if (!f) return []
    const name = normalize(`${labelOf(key, f)} ${f.name}`)
    if (EXCLUSIONS.some((e) => exclusions.has(e.id) && e.test(name, f.icbfCode))) return []
    const pantry = PANTRY_UNITS.get(key)
    const portionUnit = f.portionName?.startsWith('1 ') && f.portionGrams >= 25 && f.portionGrams <= 200
      ? ([f.portionName.slice(2), f.portionGrams] as [string, number]) : undefined
    return [{ key, label: labelOf(key, f), food: f, role: roleOf(f), favorite: favorites.has(key), unit: pantry?.unit ?? portionUnit }]
  })
}

// Lo mismo, pero leyendo todo de la base (para armar el menú sin abrir el asistente).
export async function loadCandidates(prefs: PlannerPrefs): Promise<Candidate[]> {
  const myFoods = await db.foods.toArray()
  let selected = prefs.selected
  if (!selected.length) {
    const freq = (await frequentFoodIds(12)).map((id) => myFoods.find((f) => f.id === id)).filter((f): f is Food => !!f)
    selected = [...new Set([...freq.map(keyOf), ...STARTER])]
  }
  const icbf = await icbfByCodes(selected.filter((k) => !k.startsWith('f')))
  const all = new Map<string, AnyFood>(icbf)
  for (const f of myFoods) if (!f.icbfCode || !all.has(f.icbfCode)) all.set(keyOf(f), f)
  return makeCandidates(selected, all, prefs)
}
