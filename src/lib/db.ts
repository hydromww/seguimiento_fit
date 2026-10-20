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
  // De dónde salió: creado por ti o importado de Open Food Facts.
  source: 'propio' | 'openfoodfacts'
  barcode?: string
  per100g: Nutrients
  // Una porción habitual, para no tener que pesar siempre (ej. "1 huevo" = 50 g).
  portionName: string
  portionGrams: number
  favorite: boolean
  createdAt: number
}

export const db = new Dexie('seguimiento-fit') as Dexie & {
  foods: EntityTable<Food, 'id'>
}

// Versión 1 del "esquema": qué tablas hay y por qué campos se puede buscar rápido.
// Si en el futuro añadimos tablas (comidas del día, metas...), se crea la versión 2
// y Dexie actualiza la base sin perder lo que ya tienes.
db.version(1).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
})
