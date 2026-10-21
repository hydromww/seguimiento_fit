// El menú de la semana: 7 días armados por el asistente, con platos variados.
//
// Cómo logra la variedad (detalle en COMO-FUNCIONA.md):
// - Cada día se arma con el mismo asistente de los planes, con la meta de ese día
//   (pesas, cardio o descanso).
// - Lo que ya salió en la semana pierde probabilidad cada vez que se usa, así van
//   rotando las proteínas y los carbohidratos.
// - La proteína del almuerzo o la cena de ayer casi no puede repetirse hoy, y un
//   almuerzo igual a otro de la semana (misma proteína y mismo carbohidrato) se descarta.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Meal, type Menu, type MenuDay, type Nutrients, type PlanItem } from './db'
import { addDays, dayKey, weekOf } from './dates'
import { MEALS } from './diary'
import { goalKinds, type Goals } from './goals'
import { keyOfItem, loadCandidates } from './candidates'
import { buildPlan, itemFor, matchOf, roleOf, totalsOf, type AnyFood, type Candidate, type Role } from './planner'
import { loadPrefs, type PlannerPrefs } from './plans'

export const mondayOf = (date: string) => weekOf(date)[0]

// undefined = cargando, null = esa semana aún no tiene menú
export const useMenu = (weekStart: string) =>
  useLiveQuery(async () => (await db.menus.get(weekStart)) ?? null, [weekStart])

export const saveMenu = (menu: Menu) => db.menus.put(menu)

// El tipo de día y su meta, para un día de la semana (0 = lunes).
export function kindOf(goals: Goals | null | undefined, weekday: number) {
  const kinds = goalKinds(goals)
  return kinds.find((k) => k.days.includes(weekday)) ?? kinds[0]
}

const roleOfItem = (it: PlanItem): Role => roleOf({ name: it.name, per100g: it.per100g, icbfCode: it.icbfCode } as AnyFood)
const isMain = (meal: Meal) => meal === 'almuerzo' || meal === 'cena'
const proteinsOf = (items: PlanItem[]) => new Set(items.filter((it) => isMain(it.meal) && roleOfItem(it) === 'proteina').map(keyOfItem))
// Un almuerzo "igual" a otro: misma proteína y mismo carbohidrato.
const lunchOf = (items: PlanItem[]) =>
  items.filter((it) => it.meal === 'almuerzo' && ['proteina', 'carbo'].includes(roleOfItem(it))).map(keyOfItem).sort().join('+')

interface Context {
  candidates: Candidate[]
  goals: Goals
  prefs: PlannerPrefs
}

// Cuántas veces sale cada alimento en otros días de la semana.
function usage(days: (MenuDay | undefined)[], skip: number) {
  const used = new Map<string, number>()
  days.forEach((d, i) => {
    if (i === skip || !d) return
    for (const k of new Set(d.items.map(keyOfItem))) used.set(k, (used.get(k) ?? 0) + 1)
  })
  return used
}

// Arma un día. `days` son los otros días ya armados (para no repetir).
function buildDay(ctx: Context, days: (MenuDay | undefined)[], weekday: number, seed: number): MenuDay {
  const kind = kindOf(ctx.goals, weekday)
  const used = usage(days, weekday)
  const yesterday = days[weekday - 1] ? proteinsOf(days[weekday - 1]!.items) : new Set<string>()
  const tomorrow = days[weekday + 1] ? proteinsOf(days[weekday + 1]!.items) : new Set<string>()
  const lunches = new Set(days.map((d, i) => (d && i !== weekday ? lunchOf(d.items) : '')).filter(Boolean))
  const penalty = (c: Candidate, meal: Meal) => {
    let w = 0.55 ** (used.get(c.key) ?? 0)
    if (ctx.prefs.noRepeat && c.role === 'proteina' && isMain(meal) && (yesterday.has(c.key) || tomorrow.has(c.key))) w *= 0.03
    return w
  }
  let best: { items: PlanItem[]; score: number } | undefined
  for (let t = 0; t < 5; t++) {
    const r = buildPlan({ candidates: ctx.candidates, goal: kind.goal, meals: ctx.prefs.meals, evenProtein: ctx.prefs.evenProtein, seed: seed + t * 101, penalty })
    const repeated = ctx.prefs.noRepeat && lunches.has(lunchOf(r.items))
    const score = r.match - (repeated ? 40 : 0)
    if (!best || score > best.score) best = { items: r.items, score }
    if (!repeated && r.match >= 90) break
  }
  return { kind: kind.label, items: best!.items }
}

export function buildWeek(ctx: Context, seed: number): MenuDay[] {
  const days: (MenuDay | undefined)[] = Array(7).fill(undefined)
  for (let d = 0; d < 7; d++) days[d] = buildDay(ctx, days, d, seed * 7919 + d * 131)
  return days as MenuDay[]
}

async function context(): Promise<Context | null> {
  const goals = (await db.settings.get('goals'))?.value as Goals | undefined
  if (!goals) return null
  const prefs = await loadPrefs()
  const candidates = await loadCandidates(prefs)
  if (!candidates.some((c) => c.role === 'proteina') || !candidates.some((c) => c.role === 'carbo')) return null
  return { candidates, goals, prefs }
}

// La misma semana arma el mismo menú, salvo que pidas rehacerlo (otra semilla).
const seedOf = (weekStart: string) => [...weekStart].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100000

export async function createMenu(weekStart: string, seed = seedOf(weekStart)): Promise<boolean> {
  const ctx = await context()
  if (!ctx) return false
  await saveMenu({ weekStart, days: buildWeek(ctx, seed), createdAt: Date.now() })
  return true
}

// Al abrir la app: si ya usas el menú y la semana nueva no tiene, la armamos sola.
export async function autoMenu() {
  const prefs = await loadPrefs()
  if (!prefs.autoWeekly) return
  const week = mondayOf(dayKey())
  if ((await db.menus.count()) === 0 || (await db.menus.get(week))) return
  await createMenu(week)
}

// ⇄ en un plato: otro plato para esa comida, con lo que le falta al día para su meta.
export async function swapDish(menu: Menu, weekday: number, meal: Meal, tries: number): Promise<Menu | null> {
  const ctx = await context()
  if (!ctx) return null
  const day = menu.days[weekday]
  const others = day.items.filter((it) => it.meal !== meal)
  const current = new Set(day.items.filter((it) => it.meal === meal).map(keyOfItem))
  const goal = kindOf(ctx.goals, weekday).goal
  const rest = totalsOf(others)
  const left = (k: keyof Nutrients, min: number) => Math.max(min, goal[k] - rest[k])
  const target: Nutrients = { ...goal, kcal: left('kcal', 150), protein: left('protein', 8), carbs: left('carbs', 10), fat: left('fat', 3) }
  const used = usage(menu.days, -1)
  const penalty = (c: Candidate) => (current.has(c.key) ? 0.05 : 1) * 0.6 ** (used.get(c.key) ?? 0)
  const r = buildPlan({ candidates: ctx.candidates, goal: target, meals: [meal], evenProtein: false, seed: Date.now() % 100000 + tries, penalty })
  return withDay(menu, weekday, { ...day, items: [...others, ...r.items] })
}

// ⇄ en un ingrediente: el siguiente alimento del mismo tipo, con las mismas calorías.
export async function swapIngredient(menu: Menu, weekday: number, index: number): Promise<Menu | null> {
  const ctx = await context()
  if (!ctx) return null
  const day = menu.days[weekday]
  const item = day.items[index]
  const role = roleOfItem(item)
  const inMeal = new Set(day.items.filter((it) => it.meal === item.meal).map(keyOfItem))
  const options = ctx.candidates.filter((c) => c.role === role).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label))
  const at = options.findIndex((c) => c.key === keyOfItem(item))
  const next = [...options.slice(at + 1), ...options.slice(0, Math.max(0, at))].find((c) => !inMeal.has(c.key))
  if (!next) return null
  const kcal = (item.per100g.kcal * item.grams) / 100
  return withDay(menu, weekday, { ...day, items: day.items.map((it, i) => (i === index ? itemFor(next, item.meal, kcal) : it)) })
}

export const withDay = (menu: Menu, weekday: number, day: MenuDay): Menu => ({ ...menu, days: menu.days.map((d, i) => (i === weekday ? day : d)) })

// Las comidas de un día en orden, con sus alimentos (los dos snacks van juntos).
export function mealsOf(items: PlanItem[]) {
  return MEALS.map(({ id, label }) => ({
    meal: id, label,
    items: items.map((it, index) => ({ it, index })).filter((x) => x.it.meal === id),
  })).filter((m) => m.items.length > 0)
}

// El nombre del plato a partir de sus alimentos: "Pollo con arroz, fríjoles y aguacate".
const ORDER: Role[] = ['proteina', 'carbo', 'verdura', 'grasa', 'lacteo', 'fruta']
const SALAD = /lechuga|tomate|pepino|espinaca|zanahoria|repollo|cebolla/
function shortName(it: PlanItem): string {
  let n = it.name.split(',')[0].trim()
  const inside = n.match(/\(([^)]+)\)/)
  n = (inside ? inside[1] : n).replace(/^(pechuga|lomo|filete|muslo) de /i, '').replace(/ (en hojuelas|en agua|blanco|blanca|entera|descremada)$/i, '')
  n = n.toLowerCase()
  if (it.unitName && it.unitGrams && it.grams / it.unitGrams >= 1.5 && !n.endsWith('s')) n += /[aeiou]$/.test(n) ? 's' : 'es'
  const words = n.split(/\s+/)
  return words.length > 3 ? words.slice(0, 3).join(' ') : n
}
export function dishName(items: PlanItem[]): string {
  const sorted = [...items].sort((a, b) => ORDER.indexOf(roleOfItem(a)) - ORDER.indexOf(roleOfItem(b)))
  const parts: string[] = []
  for (const it of sorted) {
    const n = roleOfItem(it) === 'verdura' && SALAD.test(it.name.toLowerCase()) ? 'ensalada' : shortName(it)
    if (!parts.includes(n)) parts.push(n)
  }
  if (!parts.length) return ''
  const [first, ...rest] = parts
  const tail = rest.length > 1 ? `${rest.slice(0, -1).join(', ')} y ${rest.at(-1)}` : rest[0]
  const name = tail ? `${first} con ${tail}` : first
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// "3 huevos · 1 arepa · 1 banano": lo principal de cada alimento, cortito.
export function dishSummary(items: PlanItem[]): string {
  return items.map((it) => {
    if (it.unitName && it.unitGrams) {
      const u = Math.round((it.grams / it.unitGrams) * 2) / 2
      return `${String(u).replace('.', ',')} ${u === 1 ? it.unitName : it.unitName + 's'}`
    }
    return `${Math.round(it.grams)} g ${shortName(it)}`
  }).join(' · ')
}

// Para la vista "Semana": proteínas distintas, almuerzos repetidos y qué tanto calza.
export function weekStats(menu: Menu, goals: Goals | null | undefined) {
  const proteins = new Set(menu.days.flatMap((d) => [...proteinsOf(d.items)]))
  const lunches = menu.days.map((d) => lunchOf(d.items)).filter(Boolean)
  const match = menu.days.reduce((a, d, i) => a + matchOf(totalsOf(d.items), kindOf(goals, i)?.goal ?? totalsOf(d.items)), 0) / 7
  return { proteins: proteins.size, repeated: lunches.length - new Set(lunches).size, match: Math.round(match) }
}

export const dayOfWeek = (weekStart: string, weekday: number) => addDays(weekStart, weekday)
