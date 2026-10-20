// Conexión con Open Food Facts, la base de datos pública y gratuita de alimentos.
// Documentación: https://openfoodfacts.github.io/openfoodfacts-server/api/
import type { Food, Nutrients } from './db'

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity'

// Así llegan los datos desde Open Food Facts (solo los campos que pedimos).
interface OffProduct {
  code?: string
  product_name?: string
  product_name_es?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}

// Traduce un producto de Open Food Facts a nuestra ficha de alimento.
// Ojo: Open Food Facts guarda el sodio en gramos; nosotros lo usamos en miligramos.
export function toFood(p: OffProduct): Omit<Food, 'id'> {
  const n = p.nutriments ?? {}
  const kcal = n['energy-kcal_100g'] !== undefined
    ? num(n['energy-kcal_100g'])
    : num(n['energy_100g']) / 4.184 // si solo viene en kilojulios, lo convertimos
  const per100g: Nutrients = {
    kcal,
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
    sodium: num(n['sodium_100g']) * 1000,
  }
  const servingGrams = num(p.serving_quantity)
  return {
    name: (p.product_name_es || p.product_name || 'Sin nombre').trim(),
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    source: 'openfoodfacts',
    barcode: p.code,
    per100g,
    portionName: servingGrams > 0 ? `1 porción (${p.serving_size ?? servingGrams + ' g'})` : '100 g',
    portionGrams: servingGrams > 0 ? servingGrams : 100,
    favorite: false,
    createdAt: Date.now(),
  }
}

async function search(query: string, onlyColombia: boolean): Promise<Omit<Food, 'id'>[]> {
  // El filtro de país hace que solo salgan productos que se venden en Colombia.
  const country = onlyColombia ? '&tagtype_0=countries&tag_contains_0=contains&tag_0=colombia' : ''
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=20&lc=es${country}&fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`)
  const data: { products?: OffProduct[] } = await res.json()
  return (data.products ?? [])
    .filter((p) => p.nutriments && (p.product_name || p.product_name_es))
    .map(toFood)
}

// Busca productos por nombre: primero los que se venden en Colombia y, después,
// los del resto del mundo (sin repetir).
export async function searchProducts(query: string): Promise<{ colombia: Omit<Food, 'id'>[]; world: Omit<Food, 'id'>[] }> {
  const [colombia, world] = await Promise.all([search(query, true), search(query, false)])
  const seen = new Set(colombia.map((f) => f.barcode))
  return { colombia, world: world.filter((f) => !seen.has(f.barcode)) }
}

// Busca un producto por su código de barras. Devuelve null si no existe.
export async function getByBarcode(code: string): Promise<Omit<Food, 'id'> | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}?lc=es&fields=${FIELDS}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`)
  const data: { status?: number; product?: OffProduct } = await res.json()
  return data.status === 1 && data.product ? toFood({ code, ...data.product }) : null
}
