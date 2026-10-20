// Conexión con Open Food Facts, la base de datos pública y gratuita de alimentos.
// Documentación: https://openfoodfacts.github.io/openfoodfacts-server/api/
import type { Food, Nutrients } from './db'

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,countries_tags'

// Así llegan los datos desde Open Food Facts (solo los campos que pedimos).
interface OffProduct {
  code?: string
  product_name?: string
  product_name_es?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
  countries_tags?: string[]
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

// El buscador de Open Food Facts a veces está saturado y responde con error
// (o el navegador lo ve como "sin conexión"). Reintentamos un par de veces
// antes de rendirnos.
async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404 || i === tries) return res
    } catch (e) {
      if (i === tries || !navigator.onLine) throw e
    }
    await new Promise((r) => setTimeout(r, 1200 * i))
  }
}

// Error para distinguir "no tienes internet" de "Open Food Facts no responde".
export function offErrorMessage(): string {
  return navigator.onLine
    ? 'Open Food Facts no responde en este momento (su buscador se satura a ratos). Intenta de nuevo en un minuto.'
    : 'No tienes conexión a internet. La tabla colombiana y tus alimentos sí funcionan sin conexión.'
}

// Busca productos por nombre con una sola consulta y separa los que se venden
// en Colombia de los del resto del mundo.
export async function searchProducts(query: string): Promise<{ colombia: Omit<Food, 'id'>[]; world: Omit<Food, 'id'>[] }> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=40&lc=es&fields=${FIELDS}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`)
  const data: { products?: OffProduct[] } = await res.json()
  const products = (data.products ?? []).filter((p) => p.nutriments && (p.product_name || p.product_name_es))
  const inColombia = (p: OffProduct) => p.countries_tags?.includes('en:colombia') ?? false
  return {
    colombia: products.filter(inColombia).map(toFood),
    world: products.filter((p) => !inColombia(p)).map(toFood),
  }
}

// Busca un producto por su código de barras. Devuelve null si no existe.
export async function getByBarcode(code: string): Promise<Omit<Food, 'id'> | null> {
  const res = await fetchWithRetry(`${BASE}/api/v2/product/${encodeURIComponent(code)}?lc=es&fields=${FIELDS}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`)
  const data: { status?: number; product?: OffProduct } = await res.json()
  return data.status === 1 && data.product ? toFood({ code, ...data.product }) : null
}
