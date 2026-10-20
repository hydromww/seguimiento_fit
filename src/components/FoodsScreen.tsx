// Pantalla "Alimentos": tu base de alimentos guardados.
import { lazy, Suspense, useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food } from '../lib/db'
import { getByBarcode } from '../lib/openFoodFacts'
import { fmt, forGrams } from '../lib/nutrition'
import { FoodForm } from './FoodForm'
import { OffSearch } from './OffSearch'
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
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' })
  const [message, setMessage] = useState('')

  // useLiveQuery vuelve a leer la base de datos sola cada vez que algo cambia.
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [])

  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visible = (foods ?? [])
    .filter((f) => normalize(`${f.name} ${f.brand ?? ''}`).includes(normalize(filter)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))

  // Si un alimento importado ya estaba guardado (mismo código de barras), abrimos el tuyo.
  const openImported = useCallback(async (food: Omit<Food, 'id'>) => {
    const existing = food.barcode ? await db.foods.where('barcode').equals(food.barcode).first() : undefined
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
      setMessage('No se pudo consultar Open Food Facts. Revisa tu conexión.')
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
    <section>
      <div className="actions">
        <button onClick={() => setSheet({ kind: 'form' })}>+ Nuevo</button>
        <button onClick={() => setSheet({ kind: 'search' })}>Buscar en línea</button>
        <button onClick={() => setSheet({ kind: 'scan' })}>Escanear</button>
      </div>
      {message && <p className="hint">{message}</p>}
      <input className="filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar mis alimentos" />

      {foods && foods.length === 0 && (
        <p className="empty">Aún no tienes alimentos. Crea los que comes a menudo o búscalos en línea.</p>
      )}
      <ul className="list">
        {visible.map((f) => {
          const p = forGrams(f.per100g, f.portionGrams)
          return (
            <li key={f.id} className="food-row">
              <button
                className={'star' + (f.favorite ? ' on' : '')}
                aria-label={f.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                onClick={() => db.foods.update(f.id!, { favorite: !f.favorite })}
              >★</button>
              <button className="item" onClick={() => setSheet({ kind: 'form', food: f })}>
                <span className="item-title">{f.name}{f.brand ? <small> · {f.brand}</small> : null}</span>
                <span className="item-sub">
                  {f.portionName}: {fmt('kcal', p.kcal)} kcal · P {fmt('protein', p.protein)} · C {fmt('carbs', p.carbs)} · G {fmt('fat', p.fat)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
