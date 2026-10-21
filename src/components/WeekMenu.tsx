// "Tu semana": el menú de los 7 días, por día o de un vistazo, y cómo editar cada plato.
import { useState } from 'react'
import type { Meal, Menu, Plan } from '../lib/db'
import { addDays, dayKey, fromKey } from '../lib/dates'
import { goalKinds, type Goals } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { MEALS } from '../lib/diary'
import { amountText, matchOf, totalsOf, type AnyFood } from '../lib/planner'
import { foodToItem, planNameFor, savePlan, savePrefs, weekdayOf, type PlannerPrefs } from '../lib/plans'
import { dishName, dishSummary, kindOf, mealsOf, saveMenu, swapDish, swapIngredient, weekStats, withDay } from '../lib/menu'
import { AddSheet } from './AddSheet'
import { QuantitySheet } from './QuantitySheet'
import { Info } from './GoalWizard'
import { SwapIcon } from './Icons'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const kcalOf = (items: { per100g: { kcal: number }; grams: number }[]) => items.reduce((a, it) => a + (it.per100g.kcal * it.grams) / 100, 0)

// Color del tipo de día (el mismo de las tarjetas de planes).
function kindClass(goals: Goals | null | undefined, weekday: number) {
  const i = goalKinds(goals).findIndex((k) => k.days.includes(weekday))
  return ['k0', 'k1', 'k2', 'k3'][Math.max(0, i) % 4]
}
const dayTitle = (label: string) => (label === 'Todos los días' ? '' : label.startsWith('Día') ? label.toLowerCase() : `día de ${label.toLowerCase()}`)

interface Props {
  menu: Menu
  goals: Goals | null | undefined
  plans: Plan[]
}

export function WeekMenu({ menu, goals, plans }: Props) {
  const today = dayKey()
  const todayIndex = menu.weekStart <= today && today <= addDays(menu.weekStart, 6) ? weekdayOf(today) : 0
  const [view, setView] = useState<'dia' | 'semana'>('dia')
  const [sel, setSel] = useState(todayIndex)
  const [dish, setDish] = useState<Meal | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [picking, setPicking] = useState(false)

  const day = menu.days[sel]
  const goal = kindOf(goals, sel)?.goal
  const t = totalsOf(day.items)

  async function swap(meal: Meal, tries = 0) {
    setBusy(true)
    const next = await swapDish(menu, sel, meal, tries)
    if (next) await saveMenu(next)
    setBusy(false)
  }
  async function saveAsPlan() {
    await savePlan({ name: `${planNameFor(day.kind)} (${DAY_NAMES[sel].toLowerCase()})`, kind: day.kind, items: day.items, createdAt: Date.now() }, goals)
    setNote('✓ Lo guardé en tus planes.')
  }

  return (
    <>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={view === 'dia'} className={view === 'dia' ? 'on' : ''} onClick={() => setView('dia')}>Día</button>
        <button role="tab" aria-selected={view === 'semana'} className={view === 'semana' ? 'on' : ''} onClick={() => setView('semana')}>Semana</button>
      </div>

      {view === 'dia' ? (
        <>
          <div className="menu-days">
            {DAY_NAMES.map((name, i) => {
              const d = addDays(menu.weekStart, i)
              return (
                <button key={d} className={(i === sel ? 'on' : '') + (d === today ? ' today' : '')} aria-label={name} aria-pressed={i === sel} onClick={() => { setSel(i); setNote('') }}>
                  <span>{'LMXJVSD'[i]}</span>
                  <b>{fromKey(d).getDate()}</b>
                  <i className={kindClass(goals, i)} />
                </button>
              )
            })}
          </div>

          <section className="goal-card menu-day">
            <div className="row-between">
              <b>{DAY_NAMES[sel]}{dayTitle(day.kind) && ` · ${dayTitle(day.kind)}`}</b>
              {goal && <span className="goal-tag">Calza {matchOf(t, goal)} %</span>}
            </div>
            <span className="goal-kcal">{fmt('kcal', t.kcal)} {goal && <small>de {fmt('kcal', goal.kcal)} kcal</small>}</span>
            {goal && <div className="menu-bar"><i style={{ width: `${Math.min(100, (t.kcal / goal.kcal) * 100)}%` }} /></div>}
          </section>

          {mealsOf(day.items).map(({ meal, label, items }) => {
            const its = items.map((x) => x.it)
            return (
              <div key={meal} className="card dish">
                <button className="dish-main" onClick={() => setDish(meal)}>
                  <small><i className={`meal-dot ${meal}`} />{label} · {fmt('kcal', kcalOf(its))} kcal</small>
                  <b>{dishName(its)}</b>
                  <span>{dishSummary(its)}</span>
                </button>
                <button className="swap big" aria-label={`Otro plato para ${label.toLowerCase()}`} disabled={busy} onClick={() => swap(meal)}><SwapIcon /></button>
              </div>
            )
          })}
          {day.items.length === 0 && <p className="hint">Este día quedó vacío. Toca "Rehacer" o usa un plan guardado.</p>}

          {note && <p className="added">{note}</p>}
          <div className="menu-links">
            {plans.length > 0 && <button className="link small-link" onClick={() => setPicking(true)}>Usar un plan guardado</button>}
            {day.items.length > 0 && <button className="link small-link" onClick={saveAsPlan}>Guardar como plan</button>}
          </div>
        </>
      ) : (
        <WeekView menu={menu} goals={goals} today={today} onPick={(i) => { setSel(i); setView('dia') }} />
      )}

      {dish && <DishSheet menu={menu} weekday={sel} meal={dish} goals={goals} onSwap={(n) => swap(dish, n)} busy={busy} onClose={() => setDish(null)} />}
      {picking && (
        <div className="overlay" onClick={() => setPicking(false)}>
          <div className="bottom-sheet" role="dialog" aria-label="Usar un plan guardado" onClick={(e) => e.stopPropagation()}>
            <span className="grabber" />
            <div className="qs-head"><h2>¿Qué plan usas el {DAY_NAMES[sel].toLowerCase()}?</h2><button className="close" aria-label="Cerrar" onClick={() => setPicking(false)}>×</button></div>
            <div className="card">
              {plans.map((p) => (
                <button key={p.id} className="plan-item" onClick={async () => { await saveMenu(withDay(menu, sel, { kind: p.kind, items: p.items })); setPicking(false) }}>
                  <span><b>{p.name}</b><small>{p.items.length} alimentos</small></span>
                  <span className="plan-kcal">{fmt('kcal', totalsOf(p.items).kcal)}</span>
                </button>
              ))}
            </div>
            <span className="hint small">Reemplaza los platos de ese día por los del plan.</span>
          </div>
        </div>
      )}
    </>
  )
}

function WeekView({ menu, goals, today, onPick }: { menu: Menu; goals: Goals | null | undefined; today: string; onPick: (i: number) => void }) {
  const stats = weekStats(menu, goals)
  return (
    <>
      <div className="menu-stats">
        <div><b>{stats.proteins}</b><span>{stats.proteins === 1 ? 'proteína' : 'proteínas distintas'}</span></div>
        <div><b>{stats.repeated}</b><span>{stats.repeated === 1 ? 'almuerzo repetido' : 'almuerzos repetidos'}</span></div>
        <div><b>{stats.match} %</b><span>calza con tu meta</span></div>
      </div>
      {stats.proteins <= 2 && <Info>Para más variedad, agrega más proteínas en "Lo que tienes en casa" (toca Rehacer).</Info>}
      <div className="card week-menu">
        {menu.days.map((d, i) => {
          const date = addDays(menu.weekStart, i)
          const meals = mealsOf(d.items).filter((m) => m.meal !== 'snack')
          return (
            <button key={i} className={'week-menu-row' + (date === today ? ' today' : '')} onClick={() => onPick(i)}>
              <span className="week-menu-day">
                <b>{'LMXJVSD'[i]} {fromKey(date).getDate()}</b>
                <i className={kindClass(goals, i)}>{d.kind === 'Todos los días' ? 'Día' : d.kind}</i>
              </span>
              <span className="week-menu-dishes">
                {meals.map((m) => <span key={m.meal} className={m.meal === 'almuerzo' ? 'main' : ''}>{dishName(m.items.map((x) => x.it))}</span>)}
                {meals.length === 0 && <span>Sin platos</span>}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// Un plato por dentro: cantidades, cambiar un ingrediente, agregar o pedir otro plato.
function DishSheet({ menu, weekday, meal, goals, onSwap, busy, onClose }: {
  menu: Menu; weekday: number; meal: Meal; goals: Goals | null | undefined; onSwap: (n: number) => void; busy: boolean; onClose: () => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [tries, setTries] = useState(1)
  const [cantSwap, setCantSwap] = useState(false)
  const day = menu.days[weekday]
  const items = day.items.map((it, index) => ({ it, index })).filter((x) => x.it.meal === meal)
  const label = mealsOf(day.items).find((m) => m.meal === meal)?.label ?? ''
  const goal = kindOf(goals, weekday)?.goal
  const dayKcal = totalsOf(day.items).kcal
  const setItems = (next: typeof day.items) => saveMenu(withDay(menu, weekday, { ...day, items: next }))

  if (adding) {
    return (
      <AddSheet meal={meal} dayKcal={dayKcal} goalKcal={goal?.kcal} dayLabel="Tu día después de esto"
        onAdd={async (food: AnyFood, grams: number, m: Meal) => { await setItems([...day.items, foodToItem(food, grams, m)]) }}
        onClose={() => setAdding(false)} />
    )
  }
  if (!items.length) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="bottom-sheet" role="dialog" aria-label="Plato" onClick={(e) => e.stopPropagation()}>
          <span className="grabber" />
          <div className="qs-head"><h2>Este plato quedó vacío</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
          <div className="two-buttons"><button className="secondary" onClick={() => setAdding(true)}>Agregar un alimento</button><button className="primary" onClick={onClose}>Listo</button></div>
        </div>
      </div>
    )
  }

  const item = editing !== null ? day.items[editing] : null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label={`${label} del ${DAY_NAMES[weekday].toLowerCase()}`} onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head">
          <div><span className="sheet-kicker">{label} · {DAY_NAMES[weekday]}</span><h2>{dishName(items.map((x) => x.it))}</h2></div>
          <button className="close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <div className="card">
          {items.map(({ it, index }) => (
            <div key={index} className="plan-item">
              <button className="plan-item-main" onClick={() => setEditing(index)}><b>{it.name}</b><small>{amountText(it)}</small></button>
              <span className="plan-kcal">{fmt('kcal', (it.per100g.kcal * it.grams) / 100)}</span>
              <button className="swap" aria-label={`Cambiar ${it.name}`} onClick={async () => {
                const next = await swapIngredient(menu, weekday, index)
                if (next) await saveMenu(next)
                else setCantSwap(true)
              }}><SwapIcon /></button>
            </div>
          ))}
          <button className="link add-line" onClick={() => setAdding(true)}>+ Agregar un alimento</button>
        </div>
        {cantSwap
          ? <Info>No tienes otro alimento de ese tipo en "Lo que tienes en casa". Agrégalo allí para poder cambiarlo.</Info>
          : <Info>Toca un alimento para cambiar la cantidad. Con ⇄ lo cambias por otro parecido con las mismas calorías.</Info>}
        <div className="two-buttons">
          <button className="secondary" disabled={busy} onClick={() => { onSwap(tries); setTries(tries + 1) }}>Otro plato</button>
          <button className="primary" onClick={onClose}>Listo</button>
        </div>
      </div>
      {item && (
        <QuantitySheet
          editing
          name={item.name}
          per100g={item.per100g}
          portionName={item.unitName ? `1 ${item.unitName}` : '100 g'}
          portionGrams={item.unitGrams ?? 100}
          grams={item.grams}
          meal={item.meal}
          dayKcal={dayKcal - (item.per100g.kcal * item.grams) / 100}
          goalKcal={goal?.kcal}
          dayLabel="Tu día después de esto"
          onConfirm={async (grams, m) => { await setItems(day.items.map((x, i) => (i === editing ? { ...x, grams, meal: m } : x))); setEditing(null) }}
          onDelete={async () => { await setItems(day.items.filter((_, i) => i !== editing)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// Ajustes del menú: lo que tienes en casa, tus comidas, armar cada lunes, no repetir.
export function MenuSettings({ prefs, onPantry }: { prefs: PlannerPrefs; onPantry: () => void }) {
  const set = (patch: Partial<PlannerPrefs>) => savePrefs({ ...prefs, ...patch })
  const snacks = prefs.meals.filter((m) => m === 'snack').length
  const mealText = MEALS.filter((m) => prefs.meals.includes(m.id)).map((m) => (m.id === 'snack' && snacks > 1 ? `${snacks} snacks` : m.label.toLowerCase())).join(', ')
  return (
    <div className="card menu-settings">
      <div className="menu-setting">
        <span className="option-text"><b>Lo que tienes en casa</b><small>{prefs.selected.length ? `${prefs.selected.length} alimentos · ${prefs.favorites.length} favoritos` : 'Lo que más registras y lo típico'}</small></span>
        <button className="link small-link" onClick={onPantry}>Cambiar</button>
      </div>
      <div className="menu-setting">
        <span className="option-text"><b>Comidas del día</b><small>{mealText.charAt(0).toUpperCase() + mealText.slice(1)}</small></span>
        <button className="link small-link" onClick={onPantry}>Cambiar</button>
      </div>
      <button className="menu-setting" aria-pressed={prefs.autoWeekly} onClick={() => set({ autoWeekly: !prefs.autoWeekly })}>
        <span className="option-text"><b>Armar cada lunes</b><small>La semana nueva sale sola al abrir la app</small></span>
        <i className={prefs.autoWeekly ? 'switch on' : 'switch'} />
      </button>
      <button className="menu-setting" aria-pressed={prefs.noRepeat} onClick={() => set({ noRepeat: !prefs.noRepeat })}>
        <span className="option-text"><b>No repetir el almuerzo</b><small>Ni la misma proteína dos días seguidos</small></span>
        <i className={prefs.noRepeat ? 'switch on' : 'switch'} />
      </button>
    </div>
  )
}
