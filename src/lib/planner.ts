// El asistente que arma planes: elige alimentos de tu despensa para cada comida y
// calcula los gramos para que el día calce con tu meta de calorías y macros.
//
// Cómo lo hace (detalle en COMO-FUNCIONA.md):
// 1. Clasifica cada alimento por lo que más aporta: proteína, carbohidrato, fruta,
//    verdura, grasa o lácteo.
// 2. Cada comida tiene un molde (el almuerzo: proteína + carbohidrato + verdura + grasa).
//    Para cada hueco elige un alimento al azar, pero con más probabilidad tus favoritos
//    y lo que suele ir en esa comida (arepa al desayuno, arroz al almuerzo).
// 3. Busca los gramos que mejor cumplen, a la vez: las calorías y macros del día, el
//    reparto entre comidas y porciones razonables (mínimos cuadrados con límites).
// 4. Redondea a cantidades fáciles (5 o 10 g, o unidades enteras: 2 huevos).
import type { Food, Meal, Nutrients, PlanItem } from './db'
import { forGrams } from './nutrition'

export type Role = 'proteina' | 'carbo' | 'verdura' | 'fruta' | 'grasa' | 'lacteo'
export type AnyFood = Food | Omit<Food, 'id'>

export interface Candidate {
  key: string
  label: string
  food: AnyFood
  role: Role
  favorite: boolean
  unit?: [name: string, grams: number]
}

export interface PlanRequest {
  candidates: Candidate[]
  goal: Nutrients
  meals: Meal[] // en orden; 'snack' puede ir dos veces
  evenProtein: boolean
  seed: number
  // Para el menú de la semana: baja la probabilidad de lo que ya salió otros días.
  penalty?: (c: Candidate, meal: Meal) => number
}

export interface PlanResult {
  items: PlanItem[]
  totals: Nutrients
  match: number // 0–100: qué tanto calza con la meta
}

const SHARE: Record<Meal, number> = { desayuno: 0.25, almuerzo: 0.35, cena: 0.25, snack: 0.1 }

// Los huecos de cada comida. Cada hueco acepta uno o más papeles, en orden de preferencia.
const MOLDS: Record<Meal, Role[][]> = {
  desayuno: [['proteina'], ['carbo'], ['fruta', 'lacteo']],
  almuerzo: [['proteina'], ['carbo'], ['verdura'], ['grasa']],
  cena: [['proteina'], ['carbo'], ['verdura']],
  snack: [['lacteo', 'proteina'], ['fruta', 'carbo']],
}

const BREAKFAST = /huevo|arepa|avena|\bpan\b|queso|cuajada|leche|yogur|banano|papaya|mango|manzana|pi[ñn]a|mantequilla de man[ií]|caf[eé]|fresa|pera|granola|man[ií]/
const MAIN = /arroz|pollo|\bres\b|carne|cerdo|pescado|mojarra|at[uú]n|papa|pl[aá]tano|yuca|pasta|fr[ií]jol|lenteja|tomate|lechuga|br[oó]coli|zanahoria|aguacate|espinaca|pepino|ensalada|aceite|salm[oó]n|merluza/

const kcalOf = (n: Nutrients) => n.kcal || n.protein * 4 + n.carbs * 4 + n.fat * 9

// ¿Qué aporta más este alimento?
export function roleOf(food: AnyFood): Role {
  const n = food.per100g
  const name = food.name.toLowerCase()
  const code = food.icbfCode
  const k = kcalOf(n)
  if (k <= 0) return 'verdura'
  const ps = (n.protein * 4) / k, cs = (n.carbs * 4) / k, fs = (n.fat * 9) / k
  if (/queso|cuajada/.test(name)) return 'proteina'
  if ((code?.startsWith('G') || /leche|yogur|kumis/.test(name)) && k < 120) return 'lacteo'
  if (k < 45 && !code?.startsWith('C')) return 'verdura'
  if (ps >= 0.28) return 'proteina'
  if (fs >= 0.55) return 'grasa'
  if (code?.startsWith('C') || (k < 110 && cs >= 0.8 && n.sugar >= 0.4 * n.carbs)) return 'fruta'
  if (cs >= 0.45) return 'carbo'
  return 'lacteo'
}

// Límites por alimento, en kcal (así la avena seca y el arroz cocido quedan razonables).
function bounds(c: Candidate): { min: number; max: number; typ: number } {
  const k = kcalOf(c.food.per100g) / 100 // kcal por gramo
  const oil = (c.food.per100g.fat * 9) / Math.max(1, kcalOf(c.food.per100g)) > 0.95
  const [minK, maxK, typK] =
    c.role === 'proteina' ? [70, 450, 200]
    : c.role === 'carbo' ? [60, 550, 200]
    : c.role === 'fruta' ? [50, 220, 100]
    : c.role === 'grasa' ? (oil ? [20, 135, 45] : [60, 220, 90])
    : c.role === 'lacteo' ? [50, 250, 120]
    : [0, 0, 0]
  if (c.role === 'verdura' || k <= 0) return { min: 40, max: 200, typ: 100 }
  return { min: minK / k, max: Math.min(450, maxK / k), typ: typK / k }
}

// Números al azar repetibles: la misma "semilla" arma el mismo plan.
function rng(seed: number) {
  let a = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0 // mezcla la semilla para que 1, 2, 3 no se parezcan
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isBreakfastish = (meal: Meal) => meal === 'desayuno' || meal === 'snack'

// Qué tan buena idea es poner este alimento en esta comida.
function weight(c: Candidate, meal: Meal, used: Map<string, number>, preference: number, req: PlanRequest) {
  const name = c.label.toLowerCase() + ' ' + c.food.name.toLowerCase()
  const own = isBreakfastish(meal) ? BREAKFAST : MAIN
  const other = isBreakfastish(meal) ? MAIN : BREAKFAST
  let w = preference
  if (own.test(name)) w *= 4
  else if (other.test(name)) w *= isBreakfastish(meal) ? 0.01 : 0.08 // arroz en el snack, no; arepa en la cena, a veces
  if (c.favorite) w *= 3
  w *= (c.role === 'proteina' ? 0.05 : 0.2) ** (used.get(c.key) ?? 0)
  return w * (req.penalty?.(c, meal) ?? 1)
}

function pick(cands: { c: Candidate; w: number }[], random: () => number): Candidate | undefined {
  const total = cands.reduce((a, x) => a + x.w, 0)
  if (total <= 0) return undefined
  let r = random() * total
  for (const x of cands) if ((r -= x.w) <= 0) return x.c
  return cands.at(-1)?.c
}

interface Slot { meal: Meal; index: number; roles: Role[]; c: Candidate }

// Paso 2: elegir un alimento para cada hueco de cada comida.
function chooseFoods(req: PlanRequest): Slot[] {
  const random = rng(req.seed)
  const used = new Map<string, number>()
  const slots: Slot[] = []
  req.meals.forEach((meal, index) => {
    const inMeal = new Set<string>()
    for (const roles of MOLDS[meal]) {
      const options = roles.flatMap((role, i) =>
        req.candidates.filter((c) => c.role === role && !inMeal.has(c.key)).map((c) => ({ c, w: weight(c, meal, used, i === 0 ? 1 : 0.5, req) })))
      const c = pick(options, random)
      if (!c) continue
      inMeal.add(c.key)
      used.set(c.key, (used.get(c.key) ?? 0) + 1)
      slots.push({ meal, index, roles, c })
    }
  })
  return slots
}

// Paso 3: los gramos. Minimiza la suma de errores al cuadrado (cada uno dividido por su meta)
// con descenso por coordenadas, respetando los límites de cada alimento.
function solve(slots: Slot[], req: PlanRequest): number[] {
  const n = slots.length
  const T = req.goal
  const per = slots.map((s) => {
    const v = s.c.food.per100g
    return { kcal: kcalOf(v) / 100, protein: v.protein / 100, carbs: v.carbs / 100, fat: v.fat / 100 }
  })
  const rows: { w: number; c: number[]; t: number }[] = []
  const add = (w: number, c: number[], t: number) => rows.push({ w, c, t })
  const dayWeights = { kcal: 4, protein: 5, carbs: 3, fat: 2 } as const
  for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) {
    if (T[key] > 0) add(dayWeights[key], per.map((p) => p[key] / T[key]), 1)
  }
  // Reparto entre comidas (por posición, porque puede haber dos snacks).
  const shareTotal = req.meals.reduce((a, m) => a + SHARE[m], 0)
  req.meals.forEach((meal, index) => {
    const share = SHARE[meal] / shareTotal
    add(2, slots.map((s, i) => (s.index === index ? per[i].kcal / T.kcal : 0)), share)
    if (req.evenProtein && T.protein > 0) {
      // Proteína pareja: las comidas principales igual, los snacks la mitad.
      const parts = req.meals.reduce((a, m) => a + (m === 'snack' ? 0.5 : 1), 0)
      add(1, slots.map((s, i) => (s.index === index ? per[i].protein / T.protein : 0)), (meal === 'snack' ? 0.5 : 1) / parts)
    }
  })
  const b = slots.map((s) => bounds(s.c))
  const lambda = b.map((x) => 0.05 / (x.typ * x.typ))
  const x = b.map((v) => v.typ)
  const dot = (c: number[]) => c.reduce((a, ci, i) => a + ci * x[i], 0)
  for (let sweep = 0; sweep < 300; sweep++) {
    for (let i = 0; i < n; i++) {
      let num = lambda[i] * b[i].typ, den = lambda[i]
      for (const r of rows) {
        if (!r.c[i]) continue
        const rest = dot(r.c) - r.c[i] * x[i]
        num += r.w * r.c[i] * (r.t - rest)
        den += r.w * r.c[i] * r.c[i]
      }
      x[i] = Math.min(b[i].max, Math.max(b[i].min, num / den))
    }
  }
  return x
}

// Paso 4: cantidades fáciles de servir.
function roundGrams(g: number, c: Candidate): number {
  if (c.unit && c.unit[1] >= 25) return Math.max(1, Math.round(g / c.unit[1])) * c.unit[1]
  if (c.role === 'verdura' || g >= 100) return Math.max(10, Math.round(g / 10) * 10)
  return Math.max(5, Math.round(g / 5) * 5)
}

export function totalsOf(items: PlanItem[]): Nutrients {
  const t: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
  for (const it of items) {
    const n = forGrams(it.per100g, it.grams)
    for (const k of Object.keys(t) as (keyof Nutrients)[]) t[k] += n[k]
  }
  return t
}

export function matchOf(t: Nutrients, goal: Nutrients): number {
  const keys = ['kcal', 'protein', 'carbs', 'fat'] as const
  const err = keys.reduce((a, k) => a + (goal[k] ? Math.abs(t[k] - goal[k]) / goal[k] : 0), 0) / keys.length
  return Math.max(0, Math.round(100 - err * 100))
}

function finish(slots: Slot[], req: PlanRequest): PlanResult {
  const grams = solve(slots, req).map((g, i) => roundGrams(g, slots[i].c))
  // Después de redondear, corregimos las calorías con el carbohidrato más grande que no va por unidades.
  const items = (): PlanItem[] => slots.map((s, i) => toItem(s, grams[i]))
  const diff = req.goal.kcal - totalsOf(items()).kcal
  if (Math.abs(diff) > 40) {
    const i = slots.reduce((best, s, j) => (s.c.role === 'carbo' && !s.c.unit && (best < 0 || grams[j] > grams[best]) ? j : best), -1)
    if (i >= 0) {
      const perG = kcalOf(slots[i].c.food.per100g) / 100
      const b = bounds(slots[i].c)
      grams[i] = roundGrams(Math.min(b.max, Math.max(b.min, grams[i] + diff / perG)), slots[i].c)
    }
  }
  const final = items()
  const totals = totalsOf(final)
  return { items: final, totals, match: matchOf(totals, req.goal) }
}

function toItem(s: Slot, grams: number): PlanItem {
  const f = s.c.food
  return {
    meal: s.meal, name: s.c.label, grams, per100g: f.per100g,
    ...('id' in f && f.id ? { foodId: f.id } : {}),
    ...(f.icbfCode ? { icbfCode: f.icbfCode } : {}),
    ...(s.c.unit ? { unitName: s.c.unit[0], unitGrams: s.c.unit[1] } : {}),
  }
}

// Arma un plan completo: prueba varias combinaciones y se queda con la que mejor calza.
// Otra semilla = otras combinaciones.
export function buildPlan(req: PlanRequest): PlanResult & { slots: Slot[] } {
  let best: (PlanResult & { slots: Slot[] }) | undefined
  for (let k = 0; k < 6; k++) {
    const slots = chooseFoods({ ...req, seed: req.seed * 16 + k })
    const result = { ...finish(slots, req), slots }
    if (!best || result.match > best.match) best = result
  }
  return best!
}

// Cambia un alimento por otro del mismo tipo (el siguiente más probable) y recalcula los gramos.
export function swapSlot(req: PlanRequest, slots: Slot[], index: number, tries = 0): PlanResult & { slots: Slot[] } {
  const s = slots[index]
  const inMeal = new Set(slots.filter((x) => x.index === s.index).map((x) => x.c.key))
  const used = new Map<string, number>()
  for (const x of slots) used.set(x.c.key, (used.get(x.c.key) ?? 0) + 1)
  const options = s.roles.flatMap((role, i) =>
    req.candidates.filter((c) => c.role === role && !inMeal.has(c.key)).map((c) => ({ c, w: weight(c, s.meal, used, i === 0 ? 1 : 0.5, req) })))
  const c = pick(options, rng(req.seed + 7919 * (index + 1) + tries))
  if (!c) return { ...finish(slots, req), slots }
  const next = slots.map((x, i) => (i === index ? { ...x, c } : x))
  return { ...finish(next, req), slots: next }
}

// Un alimento puesto en lugar de otro: con más o menos las mismas calorías.
export function itemFor(c: Candidate, meal: Meal, kcal: number): PlanItem {
  const perG = kcalOf(c.food.per100g) / 100
  const b = bounds(c)
  const grams = roundGrams(perG > 0 ? Math.min(b.max, Math.max(b.min, kcal / perG)) : b.typ, c)
  return toItem({ meal, index: 0, roles: [c.role], c }, grams)
}

// "3 huevos · 150 g", "180 g"
export function amountText(item: Pick<PlanItem, 'grams' | 'unitName' | 'unitGrams'>): string {
  if (item.unitName && item.unitGrams) {
    const units = Math.round((item.grams / item.unitGrams) * 2) / 2
    if (Math.abs(units * item.unitGrams - item.grams) < 1) {
      const n = String(units).replace('.', ',')
      return `${n} ${units === 1 ? item.unitName : item.unitName + 's'} · ${Math.round(item.grams)} g`
    }
  }
  return `${Math.round(item.grams)} g`
}
