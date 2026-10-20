// Formulario para crear o editar la ficha de un alimento.
import { useState } from 'react'
import { db, type Food, type Nutrients } from '../lib/db'
import { NUTRIENTS, emptyNutrients, fmt, forGrams } from '../lib/nutrition'

interface Props {
  // Alimento de partida: uno existente (con id) o uno nuevo/importado (sin id).
  initial?: Partial<Food>
  onClose: () => void
}

export function FoodForm({ initial, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [portionName, setPortionName] = useState(initial?.portionName ?? '100 g')
  const [portionGrams, setPortionGrams] = useState(String(initial?.portionGrams ?? 100))
  // Guardamos los números como texto mientras escribes, y los convertimos al guardar.
  const [values, setValues] = useState<Record<keyof Nutrients, string>>(() => {
    const base = initial?.per100g ?? emptyNutrients()
    return Object.fromEntries(
      NUTRIENTS.map(({ key }) => [key, base[key] ? String(Math.round(base[key] * 10) / 10) : '']),
    ) as Record<keyof Nutrients, string>
  })
  const [favorite, setFavorite] = useState(initial?.favorite ?? false)
  const [error, setError] = useState('')

  const toNumber = (s: string) => {
    const n = parseFloat(s.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const per100g = Object.fromEntries(
    NUTRIENTS.map(({ key }) => [key, toNumber(values[key])]),
  ) as unknown as Nutrients
  const grams = toNumber(portionGrams)
  const perPortion = forGrams(per100g, grams)

  async function save() {
    if (!name.trim()) return setError('Ponle un nombre al alimento.')
    if (grams <= 0) return setError('La porción debe pesar más de 0 g.')
    const food: Food = {
      ...(initial as Food),
      name: name.trim(),
      brand: brand.trim() || undefined,
      source: initial?.source ?? 'propio',
      per100g,
      portionName: portionName.trim() || `${grams} g`,
      portionGrams: grams,
      favorite,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    await db.foods.put(food) // put = crea si es nuevo, actualiza si ya tiene id
    onClose()
  }

  async function remove() {
    if (initial?.id && confirm(`¿Borrar "${initial.name}"?`)) {
      await db.foods.delete(initial.id)
      onClose()
    }
  }

  return (
    <div className="sheet">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>Cancelar</button>
        <h2>{initial?.id ? 'Editar alimento' : 'Nuevo alimento'}</h2>
        <button className="link strong" onClick={save}>Guardar</button>
      </header>

      {initial?.source === 'openfoodfacts' && (
        <p className="hint">Datos de Open Food Facts. Revísalos antes de guardar, a veces vienen incompletos.</p>
      )}

      <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pechuga de pollo" /></label>
      <label>Marca (opcional)<input value={brand} onChange={(e) => setBrand(e.target.value)} /></label>

      <h3>Valores por 100 g</h3>
      <div className="grid">
        {NUTRIENTS.map(({ key, label, unit }) => (
          <label key={key}>
            {label} ({unit})
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              placeholder="0"
            />
          </label>
        ))}
      </div>

      <h3>Porción habitual</h3>
      <div className="grid">
        <label>Nombre<input value={portionName} onChange={(e) => setPortionName(e.target.value)} placeholder="Ej. 1 taza" /></label>
        <label>Peso (g)<input inputMode="decimal" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} /></label>
      </div>
      <p className="hint">
        Una porción ({fmt('kcal', grams)} g): {fmt('kcal', perPortion.kcal)} kcal · P {fmt('protein', perPortion.protein)} g ·
        C {fmt('carbs', perPortion.carbs)} g · G {fmt('fat', perPortion.fat)} g
      </p>

      <label className="toggle">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Marcar como favorito
      </label>

      {error && <p className="error">{error}</p>}
      {initial?.id && <button className="danger" onClick={remove}>Borrar alimento</button>}
    </div>
  )
}
