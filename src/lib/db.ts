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

// Ajustes guardados por nombre (por ahora, tus metas: ver lib/goals.ts).
// Una pesada: un registro por día (si te pesas dos veces, queda la última).
export interface Weight {
  date: string // AAAA-MM-DD
  kg: number
  createdAt: number
}

// Un alimento dentro de un plan. Guarda su propia copia de los valores por 100 g,
// así el plan no cambia si luego editas el alimento.
export interface PlanItem {
  meal: Meal
  name: string
  grams: number
  per100g: Nutrients
  foodId?: number // si es uno de tus alimentos
  icbfCode?: string // si viene de la tabla del ICBF
  unitName?: string // "unidad", "tajada"… para mostrar "3 unidades"
  unitGrams?: number
}

// Un plan de comida: un día tipo (por ejemplo "Día de pesas") con sus alimentos.
export interface Plan {
  id?: number
  name: string
  kind: string // el tipo de día con cuya meta se compara: "Pesas", "Descanso", "Todos los días"…
  items: PlanItem[]
  createdAt: number
}

// El menú de una semana: los platos de cada día, de lunes (0) a domingo (6).
export interface MenuDay {
  kind: string // el tipo de día con cuya meta se armó: "Pesas", "Descanso"…
  items: PlanItem[]
}
export interface Menu {
  weekStart: string // el lunes, "AAAA-MM-DD"
  days: MenuDay[]
  createdAt: number
}

// Ejercicio: rutinas (lo que planeas), entrenos (lo que hiciste) y cardio.
export interface RoutineExercise {
  exerciseId: string // del catálogo (src/lib/exercises.ts)
  sets: number
  repsMin: number
  repsMax: number
  rest: number // segundos de descanso entre series
}
export interface Routine {
  id?: number
  name: string
  days: number[] // 0 = lunes … 6 = domingo
  exercises: RoutineExercise[]
  createdAt: number
}
export interface WorkoutSet {
  exerciseId: string
  kg: number
  reps: number
  done: boolean
}
export interface Workout {
  id?: number
  date: string
  routineId?: number
  name: string
  plan: RoutineExercise[] // copia de la rutina al empezar (metas de series y reps)
  sets: WorkoutSet[]
  startedAt: number
  endedAt?: number // sin esto, el entreno sigue en curso
  kcal?: number
}
export type Intensity = 'suave' | 'moderado' | 'fuerte'
export interface Cardio {
  id?: number
  date: string
  type: string
  minutes: number
  intensity: Intensity
  kcal: number
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('seguimiento-fit') as Dexie & {
  foods: EntityTable<Food, 'id'>
  entries: EntityTable<Entry, 'id'>
  settings: EntityTable<Setting, 'key'>
  weights: EntityTable<Weight, 'date'>
  plans: EntityTable<Plan, 'id'>
  menus: EntityTable<Menu, 'weekStart'>
  routines: EntityTable<Routine, 'id'>
  workouts: EntityTable<Workout, 'id'>
  cardio: EntityTable<Cardio, 'id'>
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
// Versión 3: ajustes (metas y tus datos).
db.version(3).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
  settings: 'key',
})
// Versión 4: tu peso.
db.version(4).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
  settings: 'key',
  weights: 'date',
})
// Versión 5: planes de comida.
db.version(5).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
  settings: 'key',
  weights: 'date',
  plans: '++id, name, createdAt',
})
// Versión 6: el menú de cada semana.
db.version(6).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
  settings: 'key',
  weights: 'date',
  plans: '++id, name, createdAt',
  menus: 'weekStart',
})
// Versión 7: rutinas, entrenos y cardio.
db.version(7).stores({
  foods: '++id, name, barcode, source, favorite, createdAt',
  entries: '++id, date, foodId, createdAt',
  settings: 'key',
  weights: 'date',
  plans: '++id, name, createdAt',
  menus: 'weekStart',
  routines: '++id, createdAt',
  workouts: '++id, date, routineId, startedAt',
  cardio: '++id, date',
})
