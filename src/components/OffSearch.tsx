// Búsqueda de alimentos en Open Food Facts por nombre.
import { useState } from 'react'
import type { Food } from '../lib/db'
import { searchProducts } from '../lib/openFoodFacts'
import { fmt } from '../lib/nutrition'

interface Props {
  onPick: (food: Omit<Food, 'id'>) => void
  onClose: () => void
}

export function OffSearch({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Omit<Food, 'id'>[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      setResults(await searchProducts(query.trim()))
    } catch {
      setError('No se pudo buscar. Revisa tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sheet">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>Cerrar</button>
        <h2>Open Food Facts</h2>
        <span />
      </header>
      <form onSubmit={search} className="row">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. avena, yogur griego…" autoFocus />
        <button type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {results?.length === 0 && <p className="hint">Sin resultados. Prueba con otra palabra o crea el alimento tú mismo.</p>}
      <ul className="list">
        {results?.map((f, i) => (
          <li key={(f.barcode ?? '') + i}>
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
    </div>
  )
}
