// El progreso de un ejercicio: mejor serie, 1RM estimado, gráfica e historial.
import { exerciseById, exerciseName } from '../lib/exercises'
import { fromKey } from '../lib/dates'
import { historyOf, kgText, useWorkouts } from '../lib/training'
import { Info } from './GoalWizard'
import { BackIcon } from './Icons'

const W = 320, H = 150

export function ExerciseProgress({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const workouts = useWorkouts()
  if (!workouts) return null
  const e = exerciseById.get(exerciseId)
  const bw = !!e?.bodyweight
  const hist = historyOf(workouts, exerciseId)
  const value = (h: (typeof hist)[number]) => (bw ? h.best.reps : h.best.kg)
  const shown = hist.slice(-12)
  const best = hist.reduce<(typeof hist)[number] | null>((a, h) => (!a || value(h) > value(a) || (value(h) === value(a) && h.best.reps > a.best.reps) ? h : a), null)
  const first = hist[0], last = hist.at(-1)
  const change = first && last && value(first) > 0 ? Math.round(((value(last) - value(first)) / value(first)) * 100) : null
  const e1rm = hist.length ? Math.max(...hist.map((h) => h.e1rm)) : 0
  const date = (d: string) => fromKey(d).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })

  let chart = null
  if (shown.length >= 2) {
    const vals = shown.map(value)
    let lo = Math.min(...vals), hi = Math.max(...vals)
    const pad = Math.max(1, (hi - lo) * 0.2)
    lo -= pad; hi += pad
    const x = (i: number) => 10 + (i / (shown.length - 1)) * (W - 50)
    const y = (v: number) => H - 10 - ((v - lo) / (hi - lo)) * (H - 20)
    const ticks = [lo + pad, (lo + hi) / 2, hi - pad]
    chart = (
      <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Progreso de ${exerciseName(exerciseId)}`}>
        {ticks.map((v) => (
          <g key={v}><line x1="0" x2={W} y1={y(v)} y2={y(v)} className="wc-grid" /><text x={W} y={y(v) - 3} textAnchor="end" className="wc-label">{kgText(Math.round(v * 2) / 2)}</text></g>
        ))}
        <polyline points={shown.map((h, i) => `${x(i)},${y(value(h))}`).join(' ')} className="wc-trend" />
        {shown.map((h, i) => <circle key={h.startedAt} cx={x(i)} cy={y(value(h))} r={i === shown.length - 1 ? 5.5 : 3.5} className={i === shown.length - 1 ? 'wc-now' : 'wc-dot'} />)}
      </svg>
    )
  }

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">{exerciseName(exerciseId)}</span>
        <span className="spacer" />
      </div>
      {!hist.length ? (
        <Info>Aún no has hecho este ejercicio. Cuando lo hagas en un entreno, aquí verás cómo vas.</Info>
      ) : (
        <>
          <div className="menu-stats">
            <div><b>{bw ? best!.best.reps : `${kgText(best!.best.kg)} kg`}</b><span>mejor serie{bw ? '' : ` (× ${best!.best.reps})`}</span></div>
            {!bw && <div><b>{Math.round(e1rm)} kg</b><span>1RM estimado</span></div>}
            <div><b>{change === null ? '—' : `${change >= 0 ? '+' : '−'} ${Math.abs(change)} %`}</b><span>desde el inicio</span></div>
          </div>
          <div className="card stack">
            <div className="row-between"><b>{bw ? 'Reps de tu mejor serie' : 'Peso de tu mejor serie'}</b><span className="hint small">{shown.length} entrenos</span></div>
            {chart ?? <span className="hint">Con un entreno más aparece la gráfica.</span>}
          </div>
          <div className="card">
            {[...hist].reverse().slice(0, 10).map((h) => (
              <div key={h.startedAt} className="hist-row">
                <b>{date(h.date)}</b>
                <span>{h.sets.map((s) => (bw ? `${s.reps}` : `${kgText(s.kg)}×${s.reps}`)).join(' · ')}</span>
              </div>
            ))}
          </div>
          {!bw && <Info>El 1RM estimado es el máximo que podrías levantar una vez (fórmula de Epley). Cuando completas todas las series con las reps máximas, te sugiero subir {kgText(e?.step ?? 2.5)} kg.</Info>}
        </>
      )}
    </div>
  )
}
