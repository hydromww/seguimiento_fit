// Pantalla "Hoy": tu día dividido por comidas, con lo que te queda de calorías arriba.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry, type Meal } from '../lib/db'
import { addDays, dayKey, longDate, weekdayLetter, weekOf, fromKey } from '../lib/dates'
import { entryPer100g, MEALS, mealForNow, sum, updateEntry } from '../lib/diary'
import { fmt } from '../lib/nutrition'
import { dayNote, goalFor, useGoals } from '../lib/goals'
import { CalorieGauge } from './CalorieGauge'
import { AddSheet } from './AddSheet'
import { QuantitySheet } from './QuantitySheet'
import { PlusIcon } from './Icons'

export function TodayScreen() {
  const today = dayKey()
  const [date, setDate] = useState(today)
  const [adding, setAdding] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]) ?? []
  const totals = sum(entries)
  // Para corregir un registro usamos la porción del alimento original, si aún existe.
  const editFood = useLiveQuery(() => (editing ? db.foods.get(editing.foodId) : undefined), [editing])
  const goals = useGoals()
  const goal = goalFor(goals ?? undefined, date)

  if (adding) {
    return <AddSheet date={date} meal={adding} dayKcal={totals.kcal} goalKcal={goal?.kcal} onClose={() => setAdding(null)} />
  }

  const isToday = date === today
  return (
    <section className="screen">
      <header className="top today-top">
        <span className="greeting">{longDate(date).replace(/^./, (c) => c.toUpperCase())}</span>
        <div className="today-title">
          <h1>{isToday ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : fromKey(date).toLocaleDateString('es', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase())}</h1>
          {!isToday && <button className="link" onClick={() => setDate(today)}>Volver a hoy</button>}
        </div>
      </header>

      <div className="week">
        <button className="week-arrow" aria-label="Semana anterior" onClick={() => setDate(addDays(date, -7))}>‹</button>
        {weekOf(date).map((d) => (
          <button key={d} className={'week-day' + (d === date ? ' on' : '') + (d === today ? ' today' : '')} onClick={() => setDate(d)} disabled={d > today}>
            <span>{weekdayLetter(d)}</span>
            <b>{fromKey(d).getDate()}</b>
          </button>
        ))}
        <button className="week-arrow" aria-label="Semana siguiente" onClick={() => setDate(addDays(date, 7) > today ? today : addDays(date, 7))} disabled={weekOf(date).includes(today)}>›</button>
      </div>

      <CalorieGauge consumed={totals} goal={goal} note={dayNote(goals ?? undefined, date)} />

      {MEALS.map(({ id, label }) => {
        const items = entries.filter((e) => e.meal === id)
        const kcal = sum(items).kcal
        return (
          <div key={id} className={'meal' + (isToday && mealForNow() === id ? ' now' : '')}>
            <div className="meal-head">
              <h2>{label}{items.length > 0 && <small>{fmt('kcal', kcal)} kcal</small>}</h2>
              <button className="meal-add" aria-label={`Agregar a ${label}`} onClick={() => setAdding(id)}><PlusIcon /></button>
            </div>
            {items.length === 0 ? (
              <button className="meal-empty" onClick={() => setAdding(id)}>Toca + para agregar lo que comas.</button>
            ) : (
              <ul>
                {items.map((e) => (
                  <li key={e.id}>
                    <button className="entry" onClick={() => setEditing(e)}>
                      <span className="entry-text">
                        <span className="entry-name">{e.name}</span>
                        <span className="entry-sub">{fmt('kcal', e.grams)} g · P {fmt('protein', e.nutrients.protein)} · C {fmt('carbs', e.nutrients.carbs)} · G {fmt('fat', e.nutrients.fat)}</span>
                      </span>
                      <span className="entry-kcal">{fmt('kcal', e.nutrients.kcal)}<small> kcal</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {editing && (
        <QuantitySheet
          editing
          name={editing.name}
          per100g={entryPer100g(editing)}
          portionName={editFood?.portionName ?? '100 g'}
          portionGrams={editFood?.portionGrams ?? 100}
          grams={editing.grams}
          meal={editing.meal}
          dayKcal={totals.kcal - editing.nutrients.kcal}
          goalKcal={goal?.kcal}
          onConfirm={async (grams, meal) => { await updateEntry(editing, grams, meal); setEditing(null) }}
          onDelete={async () => { await db.entries.delete(editing.id!); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
