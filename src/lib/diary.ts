// El diario de comidas: registrar lo que comes y sumar el día.
import { db, type Entry, type Food, type Meal, type Nutrients } from './db'
import { emptyNutrients, forGrams, NUTRIENTS } from './nutrition'

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
  { id: 'snack', label: 'Snacks' },
]

// Una propuesta de comida según la hora, para no tener que elegirla siempre.
export function mealForNow(d = new Date()): Meal {
  const h = d.getHours()
  if (h < 11) return 'desayuno'
  if (h < 16) return 'almuerzo'
  if (h < 21) return 'cena'
  return 'snack'
}

export function sum(entries: Entry[]): Nutrients {
  const total = emptyNutrients()
  for (const e of entries) for (const { key } of NUTRIENTS) total[key] += e.nutrients[key]
  return total
}

// Los alimentos del ICBF o de Open Food Facts se guardan en tu base la primera
// vez que los registras, así después aparecen entre tus alimentos frecuentes.
export async function ensureSaved(food: Food | Omit<Food, 'id'>): Promise<number> {
  if ('id' in food && food.id) return food.id
  const existing = food.barcode
    ? await db.foods.where('barcode').equals(food.barcode).first()
    : food.icbfCode
      ? await db.foods.filter((f) => f.icbfCode === food.icbfCode).first()
      : undefined
  if (existing?.id) return existing.id
  return db.foods.add({ ...food, createdAt: Date.now() } as Food) as Promise<number>
}

export async function addEntry(food: Food | Omit<Food, 'id'>, grams: number, date: string, meal: Meal) {
  const foodId = await ensureSaved(food)
  await db.entries.add({
    date, meal, foodId, name: food.name, grams,
    nutrients: forGrams(food.per100g, grams),
    createdAt: Date.now(),
  })
}

// Cambiar la cantidad o la comida de un registro. Escalamos su propia copia de
// nutrientes (regla de tres), por si el alimento se editó después.
export async function updateEntry(entry: Entry, grams: number, meal: Meal) {
  const scaled = emptyNutrients()
  for (const { key } of NUTRIENTS) scaled[key] = (entry.nutrients[key] / entry.grams) * grams
  await db.entries.update(entry.id!, { grams, meal, nutrients: scaled })
}

// Los valores por 100 g de un registro, para poder mostrarlo como un alimento.
export function entryPer100g(entry: Entry): Nutrients {
  return forGrams(entry.nutrients, (100 / entry.grams) * 100)
}

// Ids de tus alimentos ordenados de más a menos registrados (últimos 60 días).
export async function frequentFoodIds(limit = 8): Promise<number[]> {
  const since = Date.now() - 60 * 24 * 3600 * 1000
  const counts = new Map<number, number>()
  await db.entries.where('createdAt').above(since).each((e) => counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
}
