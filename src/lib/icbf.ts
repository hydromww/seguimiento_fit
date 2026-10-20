// Tabla de Composición de Alimentos Colombianos del ICBF (2018).
// Viene dentro de la app (no necesita internet). Los datos se generan con
// scripts/icbf.mjs a partir de la transcripción guardada en datos/icbf/.
import type { Food } from './db'

type Row = [code: string, name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, sodium: number, sugar: number | null]

// El archivo pesa unos cuantos KB; lo cargamos la primera vez que se busca.
let table: Promise<Row[]> | undefined
const load = () => (table ??= import('../data/icbf.json').then((m) => m.default as Row[]))

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function toFood([code, name, kcal, protein, carbs, fat, fiber, sodium, sugar]: Row): Omit<Food, 'id'> {
  return {
    name,
    source: 'icbf',
    icbfCode: code,
    // La tabla no trae azúcar: es un estimado (ver scripts/azucar.mjs). Sin dato → 0.
    per100g: { kcal, protein, carbs, fat, fiber, sugar: sugar ?? 0, sodium },
    portionName: '100 g',
    portionGrams: 100,
    favorite: false,
    createdAt: Date.now(),
  }
}

// Busca por palabras, sin importar tildes ni mayúsculas: "platano maduro" encuentra
// "Plátano hartón, maduro, crudo". Primero los que empiezan por la primera palabra.
export async function searchIcbf(query: string, limit = 30): Promise<Omit<Food, 'id'>[]> {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const rows = await load()
  const hits = rows.filter((r) => {
    const name = normalize(r[1])
    return words.every((w) => name.includes(w))
  })
  hits.sort((a, b) => Number(!normalize(a[1]).startsWith(words[0])) - Number(!normalize(b[1]).startsWith(words[0])))
  return hits.slice(0, limit).map(toFood)
}
