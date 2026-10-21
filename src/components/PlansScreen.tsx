// Pestaña "Planes": tu semana, tus planes y cómo crear uno nuevo.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Plan } from '../lib/db'
import { addDays, dayKey, fromKey } from '../lib/dates'
import { goalKinds, useGoals, type Goals } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { totalsOf } from '../lib/planner'
import { goalForPlan, itemsFromDay, planNameFor, savePlan, savePlanWeek, usePlans, usePlanWeek, type PlanWeek } from '../lib/plans'
import { NOMBRE } from '../lib/perfil'
import { MEALS } from '../lib/diary'
import { Option } from './GoalWizard'
import { ObjectiveIcon, PlusIcon, TodayIcon } from './Icons'
import { PlanBuilder } from './PlanBuilder'
import { PlanDetail } from './PlanDetail'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Color de cada plan según su tipo de día (el mismo en la semana y en la lista).
function kindStyle(kind: string, goals: Goals | null | undefined): string {
  const i = goalKinds(goals).findIndex((k) => k.label === kind)
  return ['k0', 'k1', 'k2', 'k3'][Math.max(0, i) % 4]
}
const initial = (p: Plan) => (p.kind === 'Todos los días' ? p.name : p.kind).replace(/^Día de /i, '').charAt(0).toUpperCase()

type View = { type: 'list' } | { type: 'detail'; id: number } | { type: 'builder' }

export function PlansScreen() {
  const goals = useGoals()
  const plans = usePlans()
  const week = usePlanWeek()
  const [view, setView] = useState<View>({ type: 'list' })
  const [sheet, setSheet] = useState<'new' | 'week' | null>(null)
  const list = () => setView({ type: 'list' })

  if (view.type === 'builder') return <PlanBuilder goals={goals} onClose={list} onSaved={(id) => setView({ type: 'detail', id })} />
  if (view.type === 'detail') return <PlanDetail id={view.id} goals={goals} onClose={list} />
  if (!plans) return null

  return (
    <section className="screen">
      <header className="top plans-top">
        <span className="greeting">Hola, {NOMBRE}</span>
        <div className="row-between">
          <h1>Tus planes</h1>
          <button className="round-btn accent" aria-label="Nuevo plan" onClick={() => setSheet('new')}><PlusIcon /></button>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="card stack plans-empty">
          <span className="intro-icon"><ObjectiveIcon id="map" /></span>
          <b>Arma tu primer plan</b>
          <span className="hint">Un plan es un día tipo con sus comidas. Lo usas en Hoy con un toque y la app te lo puede armar con lo que tienes en casa.</span>
          <button className="primary big" onClick={() => setView({ type: 'builder' })}>Ármalo tú, app</button>
          <button className="link" onClick={() => setSheet('new')}>Otras formas de empezar</button>
        </div>
      ) : (
        <>
          <div className="card stack">
            <div className="row-between"><b>Tu semana</b><button className="link small-link" onClick={() => setSheet('week')}>Cambiar</button></div>
            <div className="plan-week">
              {DAYS.map((d, i) => {
                const p = plans.find((x) => x.id === week[i])
                return (
                  <div key={i}>
                    <span>{d}</span>
                    <b className={p ? kindStyle(p.kind, goals) : 'none'}>{p ? initial(p) : '—'}</b>
                  </div>
                )
              })}
            </div>
            <span className="hint small">Cada día, Hoy te muestra las comidas de su plan para agregarlas en un toque.</span>
          </div>
          {plans.map((p) => {
            const t = totalsOf(p.items)
            const goal = goalForPlan(p, goals)
            const used = week.map((id, i) => (id === p.id ? DAYS[i] : null)).filter(Boolean)
            const meals = MEALS.filter((m) => p.items.some((it) => it.meal === m.id)).length
            return (
              <button key={p.id} className="card plan-card" onClick={() => setView({ type: 'detail', id: p.id! })}>
                <div className="plan-card-top">
                  <b className={`plan-avatar ${kindStyle(p.kind, goals)}`}>{initial(p)}</b>
                  <span className="plan-card-text"><b>{p.name}</b><small>{meals} {meals === 1 ? 'comida' : 'comidas'} · {p.items.length} alimentos</small></span>
                  <span className="plan-card-kcal"><b>{fmt('kcal', t.kcal)}</b>{goal && <small>de {fmt('kcal', goal.kcal)} kcal</small>}</span>
                </div>
                {goal && <div className="plan-bar"><i style={{ width: `${Math.min(100, (t.kcal / goal.kcal) * 100)}%` }} /></div>}
                <small className="hint small">{used.length ? `Se usa: ${used.join(' · ')}` : 'Aún no está en tu semana'}</small>
              </button>
            )
          })}
        </>
      )}

      {sheet === 'new' && (
        <NewPlanSheet goals={goals} onClose={() => setSheet(null)}
          onBuilder={() => { setSheet(null); setView({ type: 'builder' }) }}
          onCreated={(id) => { setSheet(null); setView({ type: 'detail', id }) }} />
      )}
      {sheet === 'week' && <WeekSheet plans={plans} week={week} onClose={() => setSheet(null)} />}
    </section>
  )
}

// "Nuevo plan": que la app lo arme, copiar un día o empezar vacío.
function NewPlanSheet({ goals, onBuilder, onCreated, onClose }: { goals: Goals | null | undefined; onBuilder: () => void; onCreated: (id: number) => void; onClose: () => void }) {
  const kinds = goalKinds(goals)
  const [mode, setMode] = useState<'app' | 'copy' | 'empty'>('app')
  const [kind, setKind] = useState(kinds[0]?.label ?? 'Todos los días')
  const [name, setName] = useState('')
  const [day, setDay] = useState<string | null>(null)
  const today = dayKey()
  // Los días recientes en los que anotaste algo, para copiarlos.
  const days = useLiveQuery(async () => {
    const entries = await db.entries.where('date').between(addDays(today, -21), today, true, true).toArray()
    const map = new Map<string, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.nutrients.kcal)
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [today]) ?? []

  async function create() {
    if (mode === 'app') return onBuilder()
    const items = mode === 'copy' && day ? await itemsFromDay(day) : []
    const id = await savePlan({ name: name.trim() || planNameFor(kind), kind, items, createdAt: Date.now() }, goals)
    onCreated(id)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label="Nuevo plan" onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head"><h2>Nuevo plan</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <Option icon={<ObjectiveIcon id="map" />} title="Ármalo tú, app" tag="Recomendado" on={mode === 'app'}
          sub="Con lo que tienes en casa, tus favoritos y tu meta." onClick={() => setMode('app')} />
        <Option icon={<TodayIcon />} title="Copiar un día que ya comí" on={mode === 'copy'} sub="Toma lo que anotaste ese día." onClick={() => setMode('copy')} />
        <Option icon={<PlusIcon />} title="Empezar vacío" on={mode === 'empty'} sub="Agrega los alimentos comida por comida." onClick={() => setMode('empty')} />
        {mode !== 'app' && (
          <>
            <label className="field">
              <span>Nombre</span>
              <input value={name} placeholder={planNameFor(kind)} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="chips">
              {kinds.map((k) => <button key={k.label} className={kind === k.label ? 'chip on' : 'chip'} onClick={() => setKind(k.label)}>{k.label}</button>)}
            </div>
            {mode === 'copy' && (
              days.length ? (
                <div className="chips">
                  {days.slice(0, 8).map(([d, kcal]) => (
                    <button key={d} className={day === d ? 'chip on' : 'chip'} onClick={() => setDay(d)}>
                      {d === today ? 'Hoy' : fromKey(d).toLocaleDateString('es', { weekday: 'short', day: 'numeric' })} · {fmt('kcal', kcal)}
                    </button>
                  ))}
                </div>
              ) : <span className="hint">Aún no tienes días anotados en las últimas 3 semanas.</span>
            )}
          </>
        )}
        <button className="primary big" disabled={mode === 'copy' && !day} onClick={create}>{mode === 'app' ? 'Empezar' : 'Crear plan'}</button>
      </div>
    </div>
  )
}

// "Tu semana": qué plan va cada día.
function WeekSheet({ plans, week, onClose }: { plans: Plan[]; week: PlanWeek; onClose: () => void }) {
  const [draft, setDraft] = useState<PlanWeek>(week)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label="Tu semana" onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head"><h2>Tu semana</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <div className="card week-rows">
          {DAY_NAMES.map((d, i) => (
            <label key={d} className="week-row">
              <span>{d}</span>
              <select value={draft[i] ?? ''} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? (e.target.value ? Number(e.target.value) : null) : x)))}>
                <option value="">Sin plan</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button className="primary big" onClick={async () => { await savePlanWeek(draft); onClose() }}>Guardar</button>
      </div>
    </div>
  )
}
