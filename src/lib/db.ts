// La base de datos local de la app.
// Usamos IndexedDB (una base de datos que viene dentro del navegador) a través
// de la librería Dexie, que la hace mucho más fácil de usar. Todo se guarda en
// tu propio dispositivo: no hay servidores ni cuentas.
import Dexie, { type EntityTable } from 'dexie'

// Los nutrientes que guardamos de cada alimento (nivel "intermedio").
// Siempre van referidos a 100 g de alimento, así se pueden comparar entre sí.
export interface Nutrients {
  kcal: number
  protein: number // gramos
  carbs: number // gramos
  fat: number // gramos
  fiber: number // gramos
  sugar: number // gramos
  sodium: number // miligramos
}

// La "ficha" de un alimento.
export interface Food {
  id?: number
  name: string
  brand?: string
  // De dónde salió: creado por ti, de la tabla colombiana del ICBF o de Open Food Facts.
  source: 'propio' | 'icbf' | 'openfoodfacts'
  barcode?: string
  icbfCode?: string // código en la tabla del ICBF (ej. "C010"), para no guardarlo dos veces
  per100g: Nutrients
  // Una porción habitual, para no tener que pesar siempre (ej. "1 huevo" = 50 g).
  portionName: string
  portionGrams: number
  favorite: boolean
  createdAt: number
}

// Las comidas del día en las que se puede registrar algo.
export type Meal = 'desayuno' | 'almuerzo' | 'cena' | 'snack'

// Un registro del diario: "comí 150 g de pechuga en el almuerzo del 20 de octubre".
// Guardamos una copia de los nutrientes de esa cantidad: si después editas el
// alimento, tus días pasados no cambian.
export interface Entry {
  id?: number
  date: string // día en formato AAAA-MM-DD, ej. "2026-10-20"
  meal: Meal
  foodId: number // el alimento de tu base del que salió
  name: string
  grams: number
  nutrients: Nutrients // para esa cantidad, no por 100 g
  createdAt: number
}

export const db = new Dexie('seguimiento-fit') as Dexie & {
  foods: EntityTable<Food, 'id'>
  entries: EntityTable<Entry, 'id'>
}

// Versión 1 del "esquema": qué tablas hay y por qué campos se puede buscar rápido.
// Si en el futuro añadimos tablas (comidas del día, metas...), se crea la versión 2
// y Dexie actualiza la base sin perder lo que ya tienes.
db.version(1).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
})
// Versión 2: el diario de comidas. Se busca por día y por alimento (para saber
// cuáles comes más seguido).
db.version(2).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
})
