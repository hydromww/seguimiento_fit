// Pantalla para agregar alimentos a una comida del día: buscas, tocas y eliges la cantidad.
// Se queda abierta para que puedas agregar varias cosas seguidas (arroz, pollo, ensalada…).
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food, type Meal } from '../lib/db'
import { addEntry, frequentFoodIds } from '../lib/diary'
import { normalize, searchIcbf } from '../lib/icbf'
import { getByBarcode, offErrorMessage, searchProducts } from '../lib/openFoodFacts'
import { fmt, forGrams } from '../lib/nutrition'
import { MealTabs } from './MealTabs'
import { QuantitySheet } from './QuantitySheet'
import { PlusIcon, ScanIcon, SearchIcon } from './Icons'
const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

type AnyFood = Food | Omit<Food, 'id'>

interface Props {
  date: string
  meal: Meal
  dayKcal: number
  goalKcal?: number
  onClose: () => void
}

export function AddSheet({ date, meal: initialMeal, dayKcal, goalKcal, onClose }: Props) {
  const [meal, setMeal] = useState(initialMeal)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<AnyFood | null>(null)
  const [scanning, setScanning] = useState(false)
  const [icbfResult, setIcbfResult] = useState<{ q: string; foods: AnyFood[] }>({ q: '', foods: [] })
  const [off, setOff] = useState<AnyFood[] | null>(null)
  const [offLoading, setOffLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [added, setAdded] = useState<{ count: number; kcal: number }>({ count: 0, kcal: 0 })

  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const frequent = useLiveQuery(() => frequentFoodIds(), [])

  const q = normalize(query.trim())
  // Sin búsqueda: tus frecuentes y favoritos. Con búsqueda: lo que coincida.
  const mine = !foods ? [] : q
    ? foods.filter((f) => normalize(`${f.name} ${f.brand ?? ''}`).includes(q)).slice(0, 20)
    : [
        ...(frequent ?? []).map((id) => foods.find((f) => f.id === id)).filter((f): f is Food => !!f),
        ...foods.filter((f) => f.favorite && !(frequent ?? []).includes(f.id!)),
      ]
  const savedIcbf = new Set(foods?.map((f) => f.icbfCode).filter(Boolean))

  // La tabla del ICBF se busca mientras escribes (va dentro de la app, es instantánea).
  useEffect(() => {
    let alive = true
    if (q.length >= 2) searchIcbf(q, 15).then((foods) => alive && setIcbfResult({ q, foods }))
    return () => { alive = false }
  }, [q])
  const icbf = q.length >= 2 && icbfResult.q === q ? icbfResult.foods : []

  function changeQuery(text: string) {
    setQuery(text)
    setOff(null) // los resultados de Open Food Facts eran de la búsqueda anterior
  }

  async function searchOff() {
    setOffLoading(true)
    setMessage('')
    try {
      const { colombia, world } = await searchProducts(query.trim())
      setOff([...colombia, ...world])
    } catch {
      setMessage(offErrorMessage())
    } finally {
      setOffLoading(false)
    }
  }

  async function onCode(code: string) {
    setScanning(false)
    setMessage('Buscando el producto…')
    try {
      const food = (await db.foods.where('barcode').equals(code).first()) ?? (await getByBarcode(code))
      setMessage(food ? '' : `El código ${code} no está en Open Food Facts. Puedes crearlo en Alimentos.`)
      if (food) setPicked(food)
    } catch {
      setMessage(offErrorMessage())
    }
  }

  async function confirm(grams: number) {
    if (!picked) return
    await addEntry(picked, grams, date, meal)
    const kcal = forGrams(picked.per100g, grams).kcal
    setAdded((a) => ({ count: a.count + 1, kcal: a.kcal + kcal }))
    setPicked(null)
    changeQuery('')
  }

  if (scanning) {
    return (
      <Suspense fallback={<p className="hint">Abriendo la cámara…</p>}>
        <BarcodeScanner onCode={onCode} onClose={() => setScanning(false)} />
      </Suspense>
    )
  }

  const title = meal === 'snack' ? 'Agregar a snacks' : `Agregar al ${meal}`.replace('al cena', 'a la cena')
  return (
    <div className="sheet add-sheet">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>{added.count ? 'Cerrar' : 'Cancelar'}</button>
        <h2>{title}</h2>
        <button className="link strong" onClick={onClose} style={{ visibility: added.count ? 'visible' : 'hidden' }}>Listo</button>
      </header>

      <MealTabs value={meal} onChange={setMeal} />

      <div className="search-row">
        <label className="search">
          <SearchIcon />
          <input value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Buscar alimento" aria-label="Buscar alimento" />
        </label>
        <button className="round-btn" aria-label="Escanear código de barras" onClick={() => setScanning(true)}><ScanIcon /></button>
      </div>

      {added.count > 0 && (
        <p className="added">✓ Agregaste {added.count} {added.count === 1 ? 'alimento' : 'alimentos'} · {fmt('kcal', added.kcal)} kcal</p>
      )}
      {message && <p className="hint">{message}</p>}

      <div className="results">
        {mine.length > 0 && <Section title={q ? 'Mis alimentos' : 'Frecuentes y favoritos'} foods={mine} onPick={setPicked} />}
        {!q && mine.length === 0 && <p className="hint pad">Escribe para buscar en tus alimentos y en la tabla colombiana.</p>}
        {icbf.length > 0 && <Section title="Tabla colombiana (ICBF)" foods={icbf.filter((f) => !savedIcbf.has(f.icbfCode))} onPick={setPicked} />}
        {off && <Section title="Open Food Facts" foods={off} onPick={setPicked} />}
        {q.length >= 2 && !off && (
          <button className="link more" onClick={searchOff} disabled={offLoading}>
            {offLoading ? 'Buscando en Open Food Facts…' : 'Buscar también en Open Food Facts'}
          </button>
        )}
        {off?.length === 0 && <p className="hint pad">Open Food Facts no encontró nada con esa palabra.</p>}
      </div>

      {picked && (
        <QuantitySheet
          name={picked.name}
          per100g={picked.per100g}
          portionName={picked.portionName}
          portionGrams={picked.portionGrams}
          grams={picked.portionGrams || 100}
          meal={meal}
          dayKcal={dayKcal + added.kcal}
          goalKcal={goalKcal}
          onConfirm={confirm}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

function Section({ title, foods, onPick }: { title: string; foods: AnyFood[]; onPick: (f: AnyFood) => void }) {
  if (foods.length === 0) return null
  return (
    <section className="result-group">
      <h3>{title}</h3>
      <ul>
        {foods.map((f, i) => {
          const p = forGrams(f.per100g, f.portionGrams || 100)
          return (
            <li key={('id' in f && f.id) || f.icbfCode || f.barcode || i}>
              <button className="result" onClick={() => onPick(f)}>
                <span className="result-text">
                  <span className="result-name">{f.name}</span>
                  <span className="result-sub">
                    {f.brand ? `${f.brand} · ` : ''}{f.portionName} · P {fmt('protein', p.protein)} · C {fmt('carbs', p.carbs)} · G {fmt('fat', p.fat)}
                  </span>
                </span>
                <span className="result-kcal">{fmt('kcal', p.kcal)}</span>
                <span className="add-dot" aria-hidden="true"><PlusIcon /></span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
