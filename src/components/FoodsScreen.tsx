// Pantalla "Alimentos": tu base de alimentos guardados.
import { lazy, Suspense, useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food } from '../lib/db'
import { getByBarcode, offErrorMessage } from '../lib/openFoodFacts'
import { fmt, forGrams } from '../lib/nutrition'
import { dayKey } from '../lib/dates'
import { sum } from '../lib/diary'
import { goalFor, useGoals } from '../lib/goals'
import { CalorieGauge } from './CalorieGauge'
import { MacroBar } from './MacroBar'
import { GlobeIcon, PlusIcon, ScanIcon, SearchIcon, StarIcon } from './Icons'
import { FoodForm } from './FoodForm'
import { OffSearch } from './OffSearch'
import { normalize } from '../lib/icbf'
// El escáner usa una librería pesada; la cargamos solo cuando se abre.
const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

// Qué "hoja" está abierta encima de la lista.
type Sheet =
  | { kind: 'none' }
  | { kind: 'form'; food?: Partial<Food> }
  | { kind: 'search' }
  | { kind: 'scan' }

export function FoodsScreen() {
  const [filter, setFilter] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' })
  const [message, setMessage] = useState('')

  // useLiveQuery vuelve a leer la base de datos sola cada vez que algo cambia.
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [])
  const goals = useGoals()
  const todayEntries = useLiveQuery(() => db.entries.where('date').equals(dayKey()).toArray(), []) ?? []

  const visible = (foods ?? [])
    .filter((f) => !onlyFavorites || f.favorite)
    .filter((f) => normalize(`${f.name} ${f.brand ?? ''}`).includes(normalize(filter)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))

  // Si un alimento importado ya estaba guardado (mismo código de barras), abrimos el tuyo.
  const openImported = useCallback(async (food: Omit<Food, 'id'>) => {
    const existing = food.barcode
      ? await db.foods.where('barcode').equals(food.barcode).first()
      : food.icbfCode
        ? await db.foods.filter((f) => f.icbfCode === food.icbfCode).first()
        : undefined
    setSheet({ kind: 'form', food: existing ?? food })
  }, [])

  const onCode = useCallback(async (code: string) => {
    setSheet({ kind: 'none' })
    setMessage('Buscando el producto…')
    try {
      const local = await db.foods.where('barcode').equals(code).first()
      const food = local ?? (await getByBarcode(code))
      if (food) {
        setMessage('')
        setSheet({ kind: 'form', food })
      } else {
        setMessage(`El código ${code} no está en Open Food Facts. Puedes crearlo tú.`)
        setSheet({ kind: 'form', food: { barcode: code } })
      }
    } catch {
      setMessage(offErrorMessage())
    }
  }, [])

  const close = () => setSheet({ kind: 'none' })

  if (sheet.kind === 'form') return <FoodForm initial={sheet.food} onClose={close} />
  if (sheet.kind === 'search') return <OffSearch onPick={openImported} onClose={close} />
  if (sheet.kind === 'scan') {
    return (
      <Suspense fallback={<p className="hint">Abriendo la cámara…</p>}>
        <BarcodeScanner onCode={onCode} onClose={close} />
      </Suspense>
    )
  }

  return (
    <section className="screen">
      <CalorieGauge consumed={sum(todayEntries)} goal={goalFor(goals ?? undefined, dayKey())} />

      <label className="search">
        <SearchIcon />
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar en mis alimentos" aria-label="Buscar en mis alimentos" />
      </label>

      <div className="shortcuts">
        <button className="shortcut" onClick={() => setSheet({ kind: 'form' })}>
          <span className="shortcut-icon main"><PlusIcon /></span>Nuevo
        </button>
        <button className="shortcut" onClick={() => setSheet({ kind: 'scan' })}>
          <span className="shortcut-icon"><ScanIcon /></span>Escanear
        </button>
        <button className="shortcut" onClick={() => setSheet({ kind: 'search' })}>
          <span className="shortcut-icon"><GlobeIcon /></span>En línea
        </button>
        <button className="shortcut" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>
          <span className={'shortcut-icon' + (onlyFavorites ? ' main' : '')}><StarIcon /></span>Favoritos
        </button>
      </div>

      {message && <p className="hint">{message}</p>}

      {foods && foods.length === 0 && (
        <p className="empty">Aún no tienes alimentos. Crea los que comes a menudo, escanéalos o búscalos en línea.</p>
      )}
      {foods && foods.length > 0 && visible.length === 0 && (
        <p className="empty">{onlyFavorites ? 'Todavía no tienes favoritos.' : 'Ningún alimento coincide con tu búsqueda.'}</p>
      )}
      {visible.length > 0 && (
        <ul className="food-list">
          {visible.map((f) => {
            const p = forGrams(f.per100g, f.portionGrams)
            return (
              <li key={f.id}>
                <button className="food" onClick={() => setSheet({ kind: 'form', food: f })}>
                  <span className="food-head">
                    <span className="food-text">
                      <span className="food-name">
                        {f.name}
                        {f.favorite && <span className="food-star" aria-label="Favorito"> ★</span>}
                      </span>
                      <span className="food-sub">
                        {f.portionName} · P {fmt('protein', p.protein)} · C {fmt('carbs', p.carbs)} · G {fmt('fat', p.fat)}
                      </span>
                    </span>
                    <span className="food-kcal">{fmt('kcal', p.kcal)}<small> kcal</small></span>
                  </span>
                  <MacroBar n={p} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
