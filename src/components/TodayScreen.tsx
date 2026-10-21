// Pantalla "Hoy": tu día dividido por comidas, con lo que te queda de calorías arriba.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry, type Meal } from '../lib/db'
import { addDays, dayKey, longDate, weekdayLetter, weekOf, fromKey } from '../lib/dates'
import { addEntry, entryPer100g, MEALS, mealForNow, sum, updateEntry } from '../lib/diary'
import { fmt } from '../lib/nutrition'
import { dayNote, goalFor, useGoals } from '../lib/goals'
import { CalorieGauge } from './CalorieGauge'
import { AddSheet } from './AddSheet'
import { QuantitySheet } from './QuantitySheet'
import { PlusIcon, ScaleIcon } from './Icons'
import { WeightSheet } from './WeightSheet'
import { kg, useWeights, withTrend } from '../lib/weight'
import { addItemsToDay, itemToFood, usePlans, usePlanWeek, weekdayOf } from '../lib/plans'
import { amountText } from '../lib/planner'
import { dishName, mondayOf, useMenu } from '../lib/menu'
import type { PlanItem } from '../lib/db'

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
  const weights = useWeights()
  const [logging, setLogging] = useState(false)
  const plans = usePlans()
  const week = usePlanWeek()
  const plan = plans?.find((p) => p.id === week[weekdayOf(date)])
  // El menú de la semana manda; si no hay, el plan asignado a ese día.
  const menu = useMenu(mondayOf(date))
  const menuDay = menu?.days[weekdayOf(date)]
  const planItems = menuDay?.items ?? plan?.items
  const [planItem, setPlanItem] = useState<PlanItem | null>(null)

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

      {isToday && <WeightNudge weights={weights} today={today} onLog={() => setLogging(true)} />}

      {MEALS.map(({ id, label }) => {
        const items = entries.filter((e) => e.meal === id)
        const kcal = sum(items).kcal
        const suggested = items.length === 0 ? planItems?.filter((it) => it.meal === id) ?? [] : []
        if (suggested.length > 0) {
          const total = suggested.reduce((a, it) => a + (it.per100g.kcal * it.grams) / 100, 0)
          return (
            <div key={id} className={'meal suggested' + (isToday && mealForNow() === id ? ' now' : '')}>
              <div className="meal-head">
                <h2>{label}<small className="from-plan">{menuDay ? `De tu menú · ${dishName(suggested)}` : `De tu plan · ${plan!.name}`}</small></h2>
                <button className="meal-add" aria-label={`Agregar a ${label}`} onClick={() => setAdding(id)}><PlusIcon /></button>
              </div>
              <ul>
                {suggested.map((it, i) => (
                  <li key={i}>
                    <button className="entry ghost" onClick={() => setPlanItem(it)}>
                      <span className="entry-text"><span className="entry-name">{it.name}</span><span className="entry-sub">{amountText(it)}</span></span>
                      <span className="entry-kcal">{fmt('kcal', (it.per100g.kcal * it.grams) / 100)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button className="primary add-plan" onClick={() => addItemsToDay(suggested, date)}>
                Agregar {suggested.length === 1 ? 'este' : suggested.length === 2 ? 'los 2' : `los ${suggested.length}`} · {fmt('kcal', total)} kcal
              </button>
            </div>
          )
        }
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

      {planItem && (
        <QuantitySheet
          name={planItem.name}
          per100g={planItem.per100g}
          portionName={planItem.unitName ? `1 ${planItem.unitName}` : '100 g'}
          portionGrams={planItem.unitGrams ?? 100}
          grams={planItem.grams}
          meal={planItem.meal}
          dayKcal={totals.kcal}
          goalKcal={goal?.kcal}
          onConfirm={async (grams) => { await addEntry(itemToFood(planItem), grams, date, planItem.meal); setPlanItem(null) }}
          onClose={() => setPlanItem(null)}
        />
      )}

      {logging && (
        <WeightSheet kg={weights.at(-1)?.kg ?? goals?.profile?.weight} existing={weights.at(-1)?.date === today} onClose={() => setLogging(false)} />
      )}

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

// "¿Ya te pesaste?": un toque para anotar el peso de hoy.
function WeightNudge({ weights, today, onLog }: { weights: ReturnType<typeof useWeights>; today: string; onLog: () => void }) {
  const points = withTrend(weights)
  const last = points.at(-1)
  const done = last?.date === today
  const previous = done ? points.at(-2) : last
  return (
    <button className="nudge" onClick={onLog}>
      <span className="nudge-icon"><ScaleIcon /></span>
      <span className="nudge-text">
        <b>{done ? `Peso de hoy: ${kg(last.kg)} kg` : '¿Ya te pesaste?'}</b>
        <small>
          {done ? `Tendencia ${kg(last.trend)} kg` : previous ? `${previous.date === addDays(today, -1) ? 'Ayer' : 'Última vez'}: ${kg(previous.kg)} kg · tendencia ${kg(previous.trend)}` : 'Anótalo en ayunas para ver tu tendencia.'}
        </small>
      </span>
      <span className={done ? 'nudge-btn soft' : 'nudge-btn'}>{done ? 'Editar' : 'Anotar'}</span>
    </button>
  )
}
