// "Ármalo tú, app": 4 pasos para que la app arme un plan con lo que tienes,
// lo que más te gusta y la meta del tipo de día que elijas.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food, type Meal } from '../lib/db'
import { dayKey } from '../lib/dates'
import { frequentFoodIds } from '../lib/diary'
import { goalKinds, type Goals } from '../lib/goals'
import { icbfByCodes, normalize, searchIcbf } from '../lib/icbf'
import { fmt } from '../lib/nutrition'
import { EXCLUSIONS, PANTRY, type Exclusion } from '../lib/pantry'
import { amountText, buildPlan, swapSlot, type AnyFood, type PlanRequest } from '../lib/planner'
import { keyOf, labelOf, makeCandidates, PANTRY_UNITS } from '../lib/candidates'
import { addItemsToDay, DEFAULT_PREFS, loadPrefs, planNameFor, savePlan, savePrefs, type PlannerPrefs } from '../lib/plans'
import { MEALS } from '../lib/diary'
import { Info } from './GoalWizard'
import { BackIcon, SearchIcon, SwapIcon } from './Icons'

interface Props {
  goals: Goals | null | undefined
  onSaved?: (planId: number) => void
  onClose: () => void
  // 'despensa': solo los 3 primeros pasos, para cambiar lo que usa el menú de la semana.
  mode?: 'plan' | 'despensa'
}

// Las comidas que se pueden elegir, en el orden del día.
const MEAL_ROWS: { meal: Meal; label: string; sub: string; key: string }[] = [
  { key: 'desayuno', meal: 'desayuno', label: 'Desayuno', sub: '~25 % del día' },
  { key: 'snack-am', meal: 'snack', label: 'Snack de la mañana', sub: '~10 %' },
  { key: 'almuerzo', meal: 'almuerzo', label: 'Almuerzo', sub: '~35 % · la comida fuerte' },
  { key: 'snack-pm', meal: 'snack', label: 'Snack de la tarde', sub: '~10 %' },
  { key: 'cena', meal: 'cena', label: 'Cena', sub: '~25 %' },
]
const mealsFromKeys = (keys: string[]) => MEAL_ROWS.filter((r) => keys.includes(r.key)).map((r) => r.meal)
const keysFromMeals = (meals: Meal[]) => {
  const snacks = meals.filter((m) => m === 'snack').length
  return MEAL_ROWS.filter((r) => (r.meal === 'snack' ? (r.key === 'snack-pm' ? snacks >= 1 : snacks >= 2) : meals.includes(r.meal))).map((r) => r.key)
}

export function PlanBuilder({ goals, onSaved, onClose, mode = 'plan' }: Props) {
  const pantryOnly = mode === 'despensa'
  const kinds = goalKinds(goals)
  const [step, setStep] = useState(0)
  const [prefs, setPrefs] = useState<PlannerPrefs | null>(null)
  const [foods, setFoods] = useState<Map<string, AnyFood>>(new Map()) // todo lo que se puede elegir
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ q: string; foods: AnyFood[] }>({ q: '', foods: [] })
  const [kind, setKind] = useState(kinds[0]?.label ?? 'Todos los días')
  const [mealKeys, setMealKeys] = useState<string[]>(keysFromMeals(DEFAULT_PREFS.meals))
  const [seed, setSeed] = useState(1)
  const [swaps, setSwaps] = useState<{ index: number; n: number }[]>([])
  const [usedToday, setUsedToday] = useState(false)

  const myFoods = useLiveQuery(() => db.foods.toArray(), [])
  const frequent = useLiveQuery(() => frequentFoodIds(12), [])

  // Cargamos tus preferencias y los alimentos de la despensa (una vez).
  useEffect(() => {
    let alive = true
    ;(async () => {
      const p = await loadPrefs()
      const codes = [...new Set([...PANTRY.flatMap((g) => g.items.map((i) => i.code)), ...p.selected.filter((k) => !k.startsWith('f'))])]
      const icbf = await icbfByCodes(codes)
      if (!alive) return
      const map = new Map<string, AnyFood>()
      for (const [code, f] of icbf) map.set(code, f)
      setFoods(map)
      setPrefs(p)
      setMealKeys(keysFromMeals(p.meals))
    })()
    return () => { alive = false }
  }, [])

  // Tus alimentos (los que no son del ICBF) también se pueden elegir.
  const all = useMemo(() => {
    const map = new Map(foods)
    for (const f of myFoods ?? []) if (!f.icbfCode || !map.has(f.icbfCode)) map.set(keyOf(f), f)
    return map
  }, [foods, myFoods])

  // Si nunca has usado el asistente, arrancamos con lo que más registras.
  const selected = useMemo(() => {
    if (!prefs) return new Set<string>()
    if (prefs.selected.length) return new Set(prefs.selected)
    const freq = (frequent ?? []).map((id) => myFoods?.find((f) => f.id === id)).filter((f): f is Food => !!f)
    return new Set(freq.map(keyOf))
  }, [prefs, frequent, myFoods])
  const favorites = new Set(prefs?.favorites ?? [])
  const exclusions = new Set(prefs?.exclusions ?? [])
  const update = (patch: Partial<PlannerPrefs>) => setPrefs((p) => ({ ...(p ?? DEFAULT_PREFS), selected: [...selected], ...patch }))
  const toggle = (key: string) => update({ selected: selected.has(key) ? [...selected].filter((k) => k !== key) : [...selected, key] })
  const toggleFav = (key: string) => update({ favorites: favorites.has(key) ? [...favorites].filter((k) => k !== key) : [...favorites, key] })
  const toggleExcl = (id: Exclusion) => update({ exclusions: exclusions.has(id) ? [...exclusions].filter((k) => k !== id) : [...exclusions, id] })

  // Buscar otro alimento en el ICBF o en los tuyos.
  const q = normalize(query.trim())
  useEffect(() => {
    let alive = true
    if (q.length >= 2) searchIcbf(q, 8).then((r) => alive && setFound({ q, foods: r }))
    return () => { alive = false }
  }, [q])
  const results = q.length >= 2
    ? [...(myFoods ?? []).filter((f) => normalize(f.name).includes(q)).slice(0, 4), ...(found.q === q ? found.foods : [])].slice(0, 8)
    : []
  function addFound(f: AnyFood) {
    const key = keyOf(f)
    setFoods((m) => new Map(m).set(key, f))
    if (!selected.has(key)) toggle(key)
    setQuery('')
  }

  // Los candidatos del plan: lo elegido, sin lo que no comes.
  const candidates = makeCandidates(selected, all, { favorites: [...favorites], exclusions: [...exclusions] })
  const hasProtein = candidates.some((c) => c.role === 'proteina')
  const hasCarb = candidates.some((c) => c.role === 'carbo')
  const goal = kinds.find((k) => k.label === kind)?.goal ?? goals?.daily
  const meals = mealsFromKeys(mealKeys)
  const request: PlanRequest | null = goal ? { candidates, goal, meals, evenProtein: prefs?.evenProtein ?? true, seed } : null

  // El plan se recalcula cuando cambias algo; los cambios de alimento se aplican encima.
  const result = useMemo(() => {
    if (!request || step < 3) return null
    let r = buildPlan(request)
    for (const s of swaps) r = swapSlot(request, r.slots, s.index, s.n)
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, seed, swaps, kind, mealKeys.join(), candidates.map((c) => c.key + c.favorite).join(), prefs?.evenProtein])

  async function next() {
    if (step === 2 && prefs) await savePrefs({ ...prefs, selected: [...selected], meals })
    if (step === 2 && pantryOnly) return onClose()
    setStep((s) => s + 1)
  }
  const back = () => (step === 0 ? onClose() : setStep(step - 1))

  async function save() {
    if (!result) return
    const id = await savePlan({ name: planNameFor(kind), kind, items: result.items, createdAt: Date.now() }, goals)
    onSaved?.(id)
  }
  async function useToday() {
    if (!result) return
    await addItemsToDay(result.items, dayKey())
    setUsedToday(true)
  }

  if (!prefs) return <div className="fullscreen wizard"><p className="hint">Cargando tu despensa…</p></div>

  if (step === 3 && result && goal) {
    const t = result.totals
    return (
      <div className="fullscreen wizard">
        <div className="wiz-top">
          <button className="icon-btn" aria-label="Atrás" onClick={back}><BackIcon /></button>
          <span>Tu plan · {planNameFor(kind)}</span>
          <button className="link" onClick={() => { setSeed((s) => s + 1); setSwaps([]) }}>Otra opción</button>
        </div>
        <section className="goal-card">
          <div className="row-between">
            <span className="gauge-label">Calza con tu meta</span>
            <span className="goal-tag">{result.match} %</span>
          </div>
          <span className="goal-kcal">{fmt('kcal', t.kcal)} <small>/ {fmt('kcal', goal.kcal)} kcal</small></span>
          <MacroMatch totals={t} goal={goal} />
        </section>
        {MEALS.filter((m) => result.items.some((i) => i.meal === m.id)).map(({ id, label }) => {
          const items = result.items.map((it, index) => ({ it, index })).filter((x) => x.it.meal === id)
          return (
            <section key={id} className="card plan-meal">
              <div className="row-between"><h3>{label}</h3><span className="hint">{fmt('kcal', items.reduce((a, x) => a + (x.it.per100g.kcal * x.it.grams) / 100, 0))} kcal</span></div>
              {items.map(({ it, index }) => (
                <div key={index} className="plan-item">
                  <span><b>{it.name}</b><small>{amountText(it)}</small></span>
                  <span className="plan-kcal">{fmt('kcal', (it.per100g.kcal * it.grams) / 100)}</span>
                  <button className="swap" aria-label={`Cambiar ${it.name}`}
                    onClick={() => setSwaps((s) => [...s.filter((x) => x.index !== index), { index, n: (s.find((x) => x.index === index)?.n ?? 0) + 1 }])}>
                    <SwapIcon />
                  </button>
                </div>
              ))}
            </section>
          )
        })}
        {usedToday && <p className="added">✓ Lo agregué a tu día de hoy.</p>}
        <div className="wiz-actions two-buttons">
          <button className="secondary" onClick={useToday} disabled={usedToday}>Usar hoy</button>
          <button className="primary" onClick={save}>Guardar plan</button>
        </div>
      </div>
    )
  }

  const titles = [
    ['¿Qué tienes en casa?', 'Toca lo que tienes o puedes comprar fácil. Ya marqué lo que más registras.'],
    ['¿Cuáles comes más?', 'Marca con estrella tus favoritos. Los usaré más seguido; los demás solo para completar.'],
    pantryOnly
      ? ['¿Qué comidas haces?', 'Las uso para armar cada día de tu semana.']
      : ['¿Para qué día y cuántas comidas?', 'Uso la meta de ese día: calorías, proteína, carbos y grasa.'],
  ]
  const total = pantryOnly ? 3 : 4
  const mineGroup = (frequent ?? []).map((id) => myFoods?.find((f) => f.id === id)).filter((f): f is Food => !!f && !PANTRY_UNITS.has(keyOf(f)))
  const extra = [...selected].filter((k) => !PANTRY_UNITS.has(k) && !mineGroup.some((f) => keyOf(f) === k))
  const canGo = step === 0 ? hasProtein && hasCarb : step === 2 ? meals.length > 0 && (pantryOnly || !!goal) : true

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={back}><BackIcon /></button>
        <span>Paso {step + 1} de {total}</span>
        <span className="spacer" />
      </div>
      <div className="progress">{Array.from({ length: total }, (_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="wiz-title"><h1>{titles[step][0]}</h1><span>{titles[step][1]}</span></div>

      {step === 0 && (
        <>
          <label className="search">
            <SearchIcon />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar otro alimento (ICBF o los tuyos)" aria-label="Buscar otro alimento" />
          </label>
          {results.length > 0 && (
            <div className="card pick-results">
              {results.map((f) => (
                <button key={keyOf(f)} className="weight-row" onClick={() => addFound(f)}>
                  <span>{f.name}</span><b>{selected.has(keyOf(f)) ? '✓' : '+'}</b>
                </button>
              ))}
            </div>
          )}
          {mineGroup.length > 0 && <ChipGroup title="Tus alimentos" items={mineGroup.map((f) => [keyOf(f), f.name])} selected={selected} onToggle={toggle} />}
          {PANTRY.map((g) => <ChipGroup key={g.group} title={g.group} items={g.items.map((i) => [i.code, i.label])} selected={selected} onToggle={toggle} />)}
          {extra.length > 0 && <ChipGroup title="Agregados" items={extra.map((k) => [k, labelOf(k, all.get(k) ?? { name: k } as AnyFood)])} selected={selected} onToggle={toggle} />}
          <span className="hint">{selected.size} {selected.size === 1 ? 'alimento elegido' : 'alimentos elegidos'}{!hasProtein || !hasCarb ? ' · elige al menos una proteína y un carbohidrato' : ''}</span>
        </>
      )}

      {step === 1 && (
        <>
          <div className="chips">
            {candidates.map((c) => (
              <button key={c.key} className={favorites.has(c.key) ? 'chip sel' : 'chip'} aria-pressed={favorites.has(c.key)} onClick={() => toggleFav(c.key)}>
                {c.label}{favorites.has(c.key) ? ' ★' : ''}
              </button>
            ))}
          </div>
          <div className="card stack">
            <h4>¿Algo que no comes?</h4>
            <div className="chips">
              {EXCLUSIONS.map((e) => (
                <button key={e.id} className={exclusions.has(e.id) ? 'chip on' : 'chip soft'} aria-pressed={exclusions.has(e.id)} onClick={() => toggleExcl(e.id)}>{e.label}</button>
              ))}
            </div>
          </div>
          <Info>Si un día no tienes algo, en el plan puedes cambiarlo por otro con un toque.</Info>
        </>
      )}

      {step === 2 && (
        <>
          {!pantryOnly && (
            <div className="kind-pick">
              {kinds.map((k) => (
                <button key={k.label} className={kind === k.label ? 'on' : ''} onClick={() => setKind(k.label)}>
                  {k.label}<small>{fmt('kcal', k.goal.kcal)} kcal</small>
                </button>
              ))}
            </div>
          )}
          {!goal && !pantryOnly && <Info>Primero define tus metas en la pestaña Metas.</Info>}
          {MEAL_ROWS.map((r) => {
            const on = mealKeys.includes(r.key)
            return (
              <button key={r.key} className={on ? 'option on check-row' : 'option check-row'} aria-pressed={on}
                onClick={() => setMealKeys((k) => (on ? k.filter((x) => x !== r.key) : [...k, r.key]))}>
                <span className="option-text"><b>{r.label}</b><small>{r.sub}</small></span>
                <i className={on ? 'check on' : 'check'}>{on ? '✓' : ''}</i>
              </button>
            )
          })}
          <button className="card switch-row" onClick={() => update({ evenProtein: !(prefs.evenProtein) })} aria-pressed={prefs.evenProtein}>
            <span className="option-text"><b>Reparte la proteína parejo</b><small>Unos 30 a 45 g en cada comida, mejor para el músculo</small></span>
            <i className={prefs.evenProtein ? 'switch on' : 'switch'} />
          </button>
        </>
      )}

      <div className="wiz-actions">
        <button className="primary big" disabled={!canGo} onClick={next}>{step === 2 ? (pantryOnly ? 'Guardar' : 'Armar mi plan') : 'Continuar'}</button>
      </div>
    </div>
  )
}

function ChipGroup({ title, items, selected, onToggle }: { title: string; items: [string, string][]; selected: Set<string>; onToggle: (k: string) => void }) {
  return (
    <div className="chip-group">
      <h4>{title}</h4>
      <div className="chips">
        {items.map(([key, label]) => (
          <button key={key} className={selected.has(key) ? 'chip sel' : 'chip'} aria-pressed={selected.has(key)} onClick={() => onToggle(key)}>{label}</button>
        ))}
      </div>
    </div>
  )
}

// Proteína, carbos y grasa del plan contra la meta, en barritas.
export function MacroMatch({ totals, goal }: { totals: { protein: number; carbs: number; fat: number }; goal: { protein: number; carbs: number; fat: number } }) {
  return (
    <div className="goal-macros match">
      {([['Proteína', 'protein'], ['Carbos', 'carbs'], ['Grasa', 'fat']] as const).map(([label, k]) => (
        <div key={k}>
          <span>{label}</span>
          <b>{Math.round(totals[k])} / {Math.round(goal[k])} g</b>
          <i><i style={{ width: `${Math.min(100, (totals[k] / Math.max(1, goal[k])) * 100)}%` }} /></i>
        </div>
      ))}
    </div>
  )
}
