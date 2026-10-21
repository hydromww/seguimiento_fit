// Revisión de 3 semanas: qué pasó con tu peso, cuánto gastas de verdad y la meta nueva.
import type { Goals } from '../lib/goals'
import { weekSummary } from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { applyReview, keepGoals, KCAL_PER_KG, kg, REVIEW_DAYS, signed, type Review } from '../lib/weight'
import { Info, Line } from './GoalWizard'
import { BackIcon } from './Icons'

type Ready = Extract<Review, { ready: true }>

const k = (n: number) => fmt('kcal', Math.round(n / 10) * 10)

// El titular según cómo vas frente a tu plan.
function headline(r: Ready): { tag: string; title: string } {
  const rate = Math.abs(r.ratePerWeek).toLocaleString('es', { maximumFractionDigits: 2 })
  const moved = r.ratePerWeek < -0.02 ? `Bajas ${rate} kg por semana` : r.ratePerWeek > 0.02 ? `Subes ${rate} kg por semana` : 'Tu peso se mantiene estable'
  if (r.planned === undefined) return { tag: 'Tu revisión', title: `${moved}.` }
  const plan = r.planned === 0 ? 'tu plan era mantenerte' : `tu plan era ${r.planned < 0 ? 'bajar' : 'subir'} ${Math.abs(r.planned).toLocaleString('es', { maximumFractionDigits: 2 })} kg`
  const gap = r.ratePerWeek - r.planned
  const tag = Math.abs(gap) <= 0.1 ? 'Vas según lo planeado' : (r.planned <= 0 ? gap > 0 : gap < 0) ? 'Vas más lento de lo planeado' : 'Vas más rápido de lo planeado'
  return { tag, title: `${moved}; ${plan}.` }
}

export function ReviewScreen({ goals, review: r, onClose }: { goals: Goals; review: Ready; onClose: () => void }) {
  const { tag, title } = headline(r)
  const delta = r.proposed - r.current
  const same = Math.abs(delta) < 30
  const before = weekSummary(goals)
  const after = r.next ? weekSummary(r.next) : []
  const capped = Math.abs(r.ideal - r.proposed) >= 30

  async function apply() {
    if (r.next) await applyReview(r.next)
    onClose()
  }
  async function keep() {
    await keepGoals(goals)
    onClose()
  }

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span>Revisión de tus 3 semanas</span>
        <span className="spacer" />
      </div>

      <section className="goal-card">
        <span className="gauge-label">{tag}</span>
        <span className="review-title">{title}</span>
        <span className="gauge-label">
          {same
            ? 'Tu meta actual está funcionando. No hace falta cambiarla.'
            : r.method === 'gasto'
              ? `Con tus datos reales, tu cuerpo gasta ${r.realTdee! < r.oldTdee ? 'un poco menos' : 'un poco más'} de lo que calculé al principio.`
              : 'No anotaste suficientes comidas para medir tu gasto, así que comparo tu ritmo con el plan y ajusto con cautela.'}
        </span>
      </section>

      <section className="card how">
        <h3>Lo que vi</h3>
        {r.method === 'gasto' && (
          <Line label="Comiste en promedio" sub={`${r.foodDays} de ${REVIEW_DAYS} días anotados`} value={`${k(r.avgIntake!)} kcal`} />
        )}
        <Line label={r.change <= 0 ? 'Tu tendencia bajó' : 'Tu tendencia subió'} sub={`en ${REVIEW_DAYS} días`} value={`${signed(r.change)} kg`} />
        {r.method === 'gasto' ? (
          <>
            <Line label="Eso equivale a" sub={`${kg(Math.abs(r.change))} kg × 7.700 kcal ÷ ${REVIEW_DAYS} días`} value={`${r.change <= 0 ? '−' : '+'} ${k(Math.abs((r.change * KCAL_PER_KG) / REVIEW_DAYS))} kcal/día`} />
            <Line label="Tu gasto real" sub={`${k(r.avgIntake!)} ${r.change <= 0 ? '+' : '−'} ${k(Math.abs((r.change * KCAL_PER_KG) / REVIEW_DAYS))} · antes calculé ${k(r.oldTdee)}`} value={`${k(r.realTdee!)} kcal`} />
          </>
        ) : (
          <Line label="Comidas anotadas" sub="Para medir tu gasto necesito al menos 14 días" value={`${r.foodDays} de ${REVIEW_DAYS}`} />
        )}
        <Line strong label="Tu nueva meta"
          sub={same ? 'Igual que ahora' : capped ? `Lo ideal serían ${k(r.ideal)}; cambio máx. 200 por vez` : `Antes ${k(r.current)} kcal`}
          value={`${k(r.proposed)} kcal`} />
      </section>

      {!same && r.next && before.length > 0 && (
        <section className="card compare">
          {before.map((g) => {
            const a = after.find((x) => x.label === g.label)
            return <div key={g.label}><span>{g.label}</span><b>{k(g.kcal)} → {a ? k(a.kcal) : '—'}</b></div>
          })}
          <span className="hint small">La diferencia va en carbohidratos y grasa; la proteína se queda casi igual.</span>
        </section>
      )}

      {!r.next && !same && (
        <Info>Tus metas las pusiste a mano, así que no las cambio sola. Si quieres, ajústalas a {k(r.proposed)} kcal desde "Ajustar a mano".</Info>
      )}
      <Info>La próxima revisión será en 3 semanas. Sigue pesándote y anotando tus comidas para que sea más precisa.</Info>

      <div className="wiz-actions two-buttons">
        {same || !r.next ? (
          <button className="primary big" onClick={keep}>Entendido</button>
        ) : (
          <>
            <button className="secondary" onClick={keep}>Mantener</button>
            <button className="primary" onClick={apply}>Aplicar {k(r.proposed)} kcal</button>
          </>
        )}
      </div>
    </div>
  )
}
