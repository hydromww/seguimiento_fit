// Un plan por dentro: sus comidas, cómo calza con la meta y "Usar hoy completo".
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Meal, type PlanItem } from '../lib/db'
import { dayKey } from '../lib/dates'
import { MEALS } from '../lib/diary'
import { goalKinds, type Goals } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { amountText, totalsOf, type AnyFood } from '../lib/planner'
import { addItemsToDay, deletePlan, foodToItem, goalForPlan } from '../lib/plans'
import { AddSheet } from './AddSheet'
import { QuantitySheet } from './QuantitySheet'
import { MacroMatch } from './PlanBuilder'
import { BackIcon, PlusIcon } from './Icons'

export function PlanDetail({ id, goals, onClose }: { id: number; goals: Goals | null | undefined; onClose: () => void }) {
  const plan = useLiveQuery(() => db.plans.get(id), [id])
  const [adding, setAdding] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [settings, setSettings] = useState(false)
  const [done, setDone] = useState(false)

  if (plan === undefined) return null
  if (!plan) return <div className="fullscreen wizard"><button className="link" onClick={onClose}>Volver a tus planes</button></div>
  const goal = goalForPlan(plan, goals)
  const t = totalsOf(plan.items)
  const setItems = (items: PlanItem[]) => db.plans.update(id, { items })

  const addFood = async (food: AnyFood, grams: number, meal: Meal) => { await setItems([...plan!.items, foodToItem(food, grams, meal)]) }

  if (adding) {
    return (
      <AddSheet meal={adding} dayKcal={t.kcal} goalKcal={goal?.kcal} dayLabel="Tu plan después de esto"
        onAdd={addFood} onClose={() => setAdding(null)} />
    )
  }

  const item = editing !== null ? plan.items[editing] : null
  return (
    <div className="fullscreen wizard plan-detail">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">{plan.name}</span>
        <button className="link" onClick={() => setSettings(true)}>Editar</button>
      </div>

      <section className="goal-card">
        <div className="row-between">
          <span className="gauge-label">Tu plan suma</span>
          {goal && <span className="goal-tag">Meta {plan.kind === 'Todos los días' ? 'diaria' : `de ${plan.kind.toLowerCase()}`}: {fmt('kcal', goal.kcal)}</span>}
        </div>
        <span className="goal-kcal">{fmt('kcal', t.kcal)} <small>kcal</small></span>
        {goal && <MacroMatch totals={t} goal={goal} />}
      </section>

      {MEALS.map(({ id: meal, label }) => {
        const items = plan.items.map((it, index) => ({ it, index })).filter((x) => x.it.meal === meal)
        return (
          <section key={meal} className="card plan-meal">
            <div className="row-between">
              <h3><i className={`meal-dot ${meal}`} />{label}{items.length > 0 && <small className="hint"> {fmt('kcal', items.reduce((a, x) => a + (x.it.per100g.kcal * x.it.grams) / 100, 0))} kcal</small>}</h3>
              <button className="meal-add" aria-label={`Agregar a ${label}`} onClick={() => setAdding(meal)}><PlusIcon /></button>
            </div>
            {items.map(({ it, index }) => (
              <button key={index} className="plan-item" onClick={() => setEditing(index)}>
                <span><b>{it.name}</b><small>{amountText(it)}</small></span>
                <span className="plan-kcal">{fmt('kcal', (it.per100g.kcal * it.grams) / 100)}</span>
              </button>
            ))}
          </section>
        )
      })}

      {done && <p className="added">✓ Agregué el plan a tu día de hoy.</p>}
      <div className="wiz-actions sticky-actions">
        <button className="primary big" disabled={!plan.items.length} onClick={async () => { await addItemsToDay(plan.items, dayKey()); setDone(true) }}>Usar hoy completo</button>
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
          dayKcal={t.kcal - (item.per100g.kcal * item.grams) / 100}
          goalKcal={goal?.kcal}
          dayLabel="Tu plan después de esto"
          onConfirm={async (grams, meal) => { await setItems(plan.items.map((x, i) => (i === editing ? { ...x, grams, meal } : x))); setEditing(null) }}
          onDelete={async () => { await setItems(plan.items.filter((_, i) => i !== editing)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
      {settings && <PlanSettings plan={plan} goals={goals} onClose={() => setSettings(false)} onDeleted={onClose} />}
    </div>
  )
}

// Cambiar el nombre o el tipo de día, o borrar el plan.
function PlanSettings({ plan, goals, onClose, onDeleted }: { plan: { id?: number; name: string; kind: string }; goals: Goals | null | undefined; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(plan.name)
  const [kind, setKind] = useState(plan.kind)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label="Editar plan" onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head"><h2>Editar plan</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="stack">
          <span className="hint">Se compara con la meta de:</span>
          <div className="chips">
            {goalKinds(goals).map((k) => <button key={k.label} className={kind === k.label ? 'chip on' : 'chip'} onClick={() => setKind(k.label)}>{k.label}</button>)}
          </div>
        </div>
        <button className="primary big" disabled={!name.trim()} onClick={async () => { await db.plans.update(plan.id!, { name: name.trim(), kind }); onClose() }}>Guardar</button>
        {confirm
          ? <button className="link danger-link" onClick={async () => { await deletePlan(plan.id!); onDeleted() }}>Sí, borrar este plan</button>
          : <button className="link danger-link" onClick={() => setConfirm(true)}>Borrar plan</button>}
      </div>
    </div>
  )
}
