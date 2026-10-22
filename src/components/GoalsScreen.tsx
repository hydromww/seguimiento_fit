// Pantalla "Metas": tus metas de calorías y macros, y desde aquí el asistente
// (guiado) o el editor manual ("Ya sé mis números").
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { addDays, dayKey } from '../lib/dates'
import { kg, planLine, recentRate, REVIEW_DAYS, reviewFor, signed, useWeights, withTrend } from '../lib/weight'
import { calculate, DEFAULT_PROFILE, OBJECTIVES, PACES, trainingDays, upgradeProfile, useGoals, type Goals, type Profile } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { hola, usePerfil } from '../lib/perfil'
import { GoalWizard, Info, Option, WeekLine } from './GoalWizard'
import { ManualGoals } from './ManualGoals'
import { EditIcon, ObjectiveIcon, ReviewIcon, UserIcon } from './Icons'
import { ProfileScreen } from './ProfileScreen'
import { WeightChart } from './WeightChart'
import { WeightSheet } from './WeightSheet'
import { WeightScreen } from './WeightScreen'
import { ReviewScreen } from './ReviewScreen'

type View = 'summary' | 'wizard' | 'manual' | 'weight' | 'review' | 'perfil'

export function GoalsScreen() {
  const goals = useGoals()
  const perfil = usePerfil()
  const [view, setView] = useState<View>('summary')
  const [choice, setChoice] = useState<'guiado' | 'manual'>('guiado')
  const [logging, setLogging] = useState(false)
  const close = () => setView('summary')
  const weights = useWeights()
  const today = dayKey()
  const entries = useLiveQuery(() => db.entries.where('date').between(addDays(today, -REVIEW_DAYS), today, true, true).toArray(), [today]) ?? []
  const review = goals ? reviewFor(goals, weights, entries) : undefined

  if (goals === undefined) return null // cargando
  if (view === 'weight') return <WeightScreen goals={goals} weights={weights} onClose={close} />
  if (view === 'review' && goals && review?.ready) return <ReviewScreen goals={goals} review={review} onClose={close} />
  if (view === 'wizard') return <GoalWizard initial={goals?.profile ? upgradeProfile(goals.profile) : DEFAULT_PROFILE} onDone={close} onClose={close} />
  if (view === 'perfil') return <ProfileScreen onClose={close} />
  if (view === 'manual') return <ManualGoals goals={goals} onDone={close} onClose={close} />

  if (!goals) {
    return (
      <section className="screen goals-intro">
        <span className="intro-icon"><ObjectiveIcon id="map" /></span>
        <div className="wiz-title">
          <h1>Armemos tus metas</h1>
          <span>Calorías y macros a tu medida. Puedes cambiarlas cuando quieras.</span>
        </div>
        <Option icon={<ObjectiveIcon id="map" />} title="Guíame paso a paso" tag="Recomendado" on={choice === 'guiado'}
          sub="6 preguntas cortas y te explico cada cosa. Unos 2 minutos." onClick={() => setChoice('guiado')} />
        <Option icon={<ObjectiveIcon id="sliders" />} title="Ya sé mis números" on={choice === 'manual'}
          sub="Escribe tus calorías y macros, en gramos, g por kilo o porcentaje." onClick={() => setChoice('manual')} />
        <Info>No hay una sola meta correcta: depende de tu objetivo, tu cuerpo y tu rutina. Por eso empezamos por ahí.</Info>
        <button className="primary big" onClick={() => setView(choice === 'guiado' ? 'wizard' : 'manual')}>Empezar</button>
      </section>
    )
  }

  return (
    <section className="screen">
      <header className="top with-avatar">
        <span className="greeting">{hola(perfil)}</span>
        <h1>Tus metas</h1>
        <button className="avatar" aria-label="Tu perfil" onClick={() => setView('perfil')}>{perfil?.name.trim()[0]?.toUpperCase() ?? <UserIcon />}</button>
      </header>
      {review?.ready && (
        <button className="nudge review" onClick={() => setView('review')}>
          <span className="nudge-icon"><ReviewIcon /></span>
          <span className="nudge-text"><b>Tu revisión está lista</b><small>Ya tengo 3 semanas de datos. Mira cómo vas y si conviene ajustar.</small></span>
          <span className="link-text">Ver</span>
        </button>
      )}
      <Summary goals={goals} />
      <WeightCard goals={goals} onOpen={() => setView('weight')} onLog={() => setLogging(true)}
        status={review && !review.ready ? (review.daysLeft > 0 ? `Tu primera revisión, en ${review.daysLeft} ${review.daysLeft === 1 ? 'día' : 'días'}` : `Para tu revisión faltan pesadas (${review.weighings} de ${review.needWeighings})`) : undefined} />
      {goals.profile && (
        <button className="card data-card" onClick={() => setView('wizard')}>
          <span>
            <b>Tus datos</b>
            <small>
              {goals.profile.sex === 'hombre' ? 'Hombre' : 'Mujer'} · {goals.profile.age} años · {(goals.profile.height / 100).toLocaleString('es', { maximumFractionDigits: 2 })} m · {fmt('protein', goals.profile.weight)} kg
              · {exerciseText(upgradeProfile(goals.profile))}
            </small>
          </span>
          <span className="meal-add"><EditIcon /></span>
        </button>
      )}
      <div className="two-buttons">
        <button className="secondary" onClick={() => setView('manual')}>Ajustar a mano</button>
        <button className="primary" onClick={() => setView('wizard')}>Recalcular</button>
      </div>
      {logging && <WeightSheet kg={weights.at(-1)?.kg ?? goals.profile?.weight} existing={weights.at(-1)?.date === today} onClose={() => setLogging(false)} />}
    </section>
  )
}

// La tarjeta "Tu peso": tendencia, ritmo y una gráfica pequeña.
function WeightCard({ goals, status, onOpen, onLog }: { goals: Goals; status?: string; onOpen: () => void; onLog: () => void }) {
  const weights = useWeights()
  const today = dayKey()
  const points = withTrend(weights)
  const last = points.at(-1)
  const rate = recentRate(weights)
  return (
    <div className="card weight-card" role="button" aria-label="Ver tu peso" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="row-between">
        <span className="nudge-text">
          <b>Tu peso</b>
          <small>{last ? `Tendencia ${kg(last.trend)} kg${rate !== undefined ? ` · ${signed(rate, 2)} kg/sem` : ''}` : 'Anota tu peso para ver tu tendencia y ajustar tu meta.'}</small>
        </span>
        <button className="nudge-btn soft" onClick={(e) => { e.stopPropagation(); onLog() }}>+ Anotar</button>
      </div>
      {points.length > 1 && <WeightChart points={points} from={points[0].date > addDays(today, -30) ? points[0].date : addDays(today, -30)} to={today} plan={planLine(goals, weights)} height={70} labels={false} />}
      {status && <span className="hint small">{status}</span>}
    </div>
  )
}

function exerciseText(p: Profile) {
  const n = trainingDays(p).length
  if (n === 0) return 'sin entrenos'
  const parts = [p.weightsDays.length && `${p.weightsDays.length} de pesas`, p.cardioDays.length && `${p.cardioDays.length} de cardio`].filter(Boolean)
  return `${n} ${n === 1 ? 'día' : 'días'} de ejercicio (${parts.join(', ')})`
}

function Summary({ goals }: { goals: Goals }) {
  const d = goals.daily
  const p = goals.profile
  const objective = p && OBJECTIVES.find((o) => o.id === p.objective)
  const pace = p && PACES[p.objective]?.[p.pace]
  const b = p && goals.mode === 'guiado' ? calculate(upgradeProfile(p)).breakdown : undefined
  const total = d.protein * 4 + d.carbs * 4 + d.fat * 9 || 1
  const rows = [
    { key: 'protein', label: 'Proteína', g: d.protein, k: 4 },
    { key: 'carbs', label: 'Carbohidratos', g: d.carbs, k: 4 },
    { key: 'fat', label: 'Grasa', g: d.fat, k: 9 },
  ] as const
  return (
    <>
      <section className="goal-card">
        <div className="row-between">
          <span className="gauge-label">Meta diaria{goals.high || goals.week ? ' (promedio)' : ''}</span>
          {objective && goals.mode === 'guiado' && (
            <span className="goal-tag">{objective.label}{pace && p.objective === 'perder' ? ` · ${pace.label}/sem` : ''}</span>
          )}
          {goals.mode === 'manual' && <span className="goal-tag">Tus números</span>}
        </div>
        <span className="goal-kcal">{fmt('kcal', d.kcal)} <small>kcal</small></span>
        {b && (
          <span className="gauge-label">
            Gastas unas {fmt('kcal', Math.round(b.tdee / 10) * 10)} kcal al día
            {Math.abs(b.adjustment) >= 10 ? `; comer ${fmt('kcal', Math.abs(Math.round(b.adjustment / 10) * 10))} ${b.adjustment < 0 ? 'menos' : 'más'} te lleva a tu objetivo.` : '; esta meta te mantiene.'}
          </span>
        )}
        <WeekLine goals={goals} />
      </section>
      <div className="card">
        <div className="macro-bar tall">
          {rows.map((r) => <div key={r.key} className={r.key} style={{ width: `${(r.g * r.k / total) * 100}%` }} />)}
        </div>
        {rows.map((r) => (
          <div key={r.key} className="goal-row">
            <i className={`dot ${r.key}`} />
            <span><b>{r.label}</b><small>{Math.round((r.g * r.k / total) * 100)} % de tus calorías · {fmt('kcal', r.g * r.k)} kcal</small></span>
            <b className="goal-g">{r.g}<small> g</small></b>
          </div>
        ))}
      </div>
      <div className="card other-goals">
        <div><small>Fibra mín.</small><b>{d.fiber} g</b></div>
        <div><small>Azúcar máx.</small><b>{d.sugar} g</b></div>
        <div><small>Sodio máx.</small><b>{fmt('kcal', d.sodium)} mg</b></div>
      </div>
    </>
  )
}
