// Búsqueda de alimentos por nombre: primero en la tabla colombiana del ICBF
// (va dentro de la app) y luego en Open Food Facts (por internet).
import { useState } from 'react'
import type { Food } from '../lib/db'
import { searchIcbf } from '../lib/icbf'
import { searchProducts } from '../lib/openFoodFacts'
import { fmt } from '../lib/nutrition'

interface Props {
  onPick: (food: Omit<Food, 'id'>) => void
  onClose: () => void
}

export function OffSearch({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [icbf, setIcbf] = useState<Omit<Food, 'id'>[] | null>(null)
  const [results, setResults] = useState<{ colombia: Omit<Food, 'id'>[]; world: Omit<Food, 'id'>[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    // La tabla del ICBF responde al instante y funciona sin conexión.
    setIcbf(await searchIcbf(query))
    try {
      setResults(await searchProducts(query.trim()))
    } catch {
      setError('No se pudo buscar en Open Food Facts. Revisa tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sheet">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>Cerrar</button>
        <h2>Buscar alimentos</h2>
        <span />
      </header>
      <form onSubmit={search} className="row">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. arepa, plátano maduro, avena…" autoFocus />
        <button type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {icbf && icbf.length > 0 && <h3>Tabla colombiana (ICBF)</h3>}
      <ResultList foods={icbf ?? []} onPick={onPick} />
      {error && <p className="error">{error}</p>}
      {results && icbf?.length === 0 && results.colombia.length + results.world.length === 0 && (
        <p className="hint">Sin resultados. Prueba con otra palabra o crea el alimento tú mismo.</p>
      )}
      {results && results.colombia.length > 0 && <h3>Productos en Colombia</h3>}
      <ResultList foods={results?.colombia ?? []} onPick={onPick} />
      {results && results.world.length > 0 && <h3>Otros países</h3>}
      <ResultList foods={results?.world ?? []} onPick={onPick} />
    </div>
  )
}

function ResultList({ foods, onPick }: { foods: Omit<Food, 'id'>[]; onPick: Props['onPick'] }) {
  if (foods.length === 0) return null
  return (
    <ul className="list">
      {foods.map((f, i) => (
        <li key={(f.barcode ?? f.icbfCode ?? '') + i}>
          <button className="item" onClick={() => onPick(f)}>
            <span className="item-title">{f.name}</span>
            <span className="item-sub">
              {f.brand ? `${f.brand} · ` : ''}100 g: {fmt('kcal', f.per100g.kcal)} kcal · P {fmt('protein', f.per100g.protein)} ·
              C {fmt('carbs', f.per100g.carbs)} · G {fmt('fat', f.per100g.fat)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
