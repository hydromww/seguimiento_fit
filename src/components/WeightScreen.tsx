// Pantalla "Tu peso": la gráfica con tu tendencia, tu ritmo y tus pesadas.
import { useState } from 'react'
import type { Weight } from '../lib/db'
import type { Goals } from '../lib/goals'
import { addDays, dayKey, fromKey } from '../lib/dates'
import { daysBetween, kg, planLine, plannedRate, recentRate, signed, slopePerDay, withTrend } from '../lib/weight'
import { WeightChart } from './WeightChart'
import { WeightSheet } from './WeightSheet'
import { BackIcon } from './Icons'

const RANGES = [['1 mes', 30], ['3 meses', 90], ['Todo', 0]] as const

export function WeightScreen({ goals, weights, onClose }: { goals: Goals | null | undefined; weights: Weight[]; onClose: () => void }) {
  const today = dayKey()
  const [range, setRange] = useState<number>(30)
  const [editing, setEditing] = useState<Weight | 'new' | null>(null)
  const points = withTrend(weights)
  const first = weights[0]?.date ?? today
  const from = range && addDays(today, -range) > first ? addDays(today, -range) : first
  const last = points.at(-1)
  const todays = weights.find((w) => w.date === today)
  const rate = recentRate(weights)
  const planned = plannedRate(goals)
  // El cambio sale de la misma recta que el ritmo, para que no lo mueva un día raro.
  const inRange = weights.filter((w) => w.date >= from)
  const change = inRange.length > 2 ? slopePerDay(inRange) * daysBetween(inRange[0].date, inRange.at(-1)!.date) : undefined

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span>Tu peso</span>
        <span className="spacer" />
      </div>

      <div className="card weight-card">
        <div className="chips">
          {RANGES.map(([label, days]) => (
            <button key={label} className={range === days ? 'chip on' : 'chip'} onClick={() => setRange(days)}>{label}</button>
          ))}
        </div>
        <WeightChart points={points} from={from} to={today} plan={planLine(goals, weights)} />
        <div className="wc-legend">
          <span><i className="l-dot" />Lo que marcó la báscula</span>
          <span><i className="l-trend" />Tendencia</span>
          {planned !== undefined && <span><i className="l-plan" />Tu plan</span>}
        </div>
      </div>

      {last && (
        <div className="stat-tiles">
          <div><span>Tendencia</span><b>{kg(last.trend)} <small>kg</small></b><span>{todays ? `hoy pesaste ${kg(todays.kg)}` : `última: ${kg(last.kg)}`}</span></div>
          <div>
            <span>Ritmo</span>
            <b>{rate !== undefined ? signed(rate, 2) : '—'} <small>kg/sem</small></b>
            {planned !== undefined && <span className={rate !== undefined && Math.abs(rate - planned) > 0.15 ? 'off' : ''}>tu plan: {signed(planned, 2)}</span>}
            {planned === undefined && <span>últimas 3 semanas</span>}
          </div>
          <div><span>Cambio</span><b>{change !== undefined ? signed(change) : '—'} <small>kg</small></b><span>{range ? `en ${range === 30 ? '1 mes' : '3 meses'}` : 'desde el inicio'}</span></div>
        </div>
      )}

      {weights.length > 0 && (
        <div className="card">
          <h3 className="card-title">Tus registros</h3>
          <div className="weight-rows">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <button key={w.date} className="weight-row" onClick={() => setEditing(w)}>
                <span>{w.date === today ? 'Hoy, ' : ''}{fromKey(w.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <b>{kg(w.kg)} kg</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wiz-actions">
        <button className="primary big" onClick={() => setEditing(todays ?? 'new')}>{todays ? 'Corregir mi peso de hoy' : 'Anotar mi peso de hoy'}</button>
      </div>

      {editing && (
        <WeightSheet
          date={editing === 'new' ? today : editing.date}
          kg={editing === 'new' ? last?.kg ?? goals?.profile?.weight : editing.kg}
          existing={editing !== 'new'}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
