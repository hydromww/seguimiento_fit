// El asistente de metas: preguntas cortas, cada una explicada, y al final el resultado
// con el detalle de cómo se calculó.
import { useState, type ReactNode } from 'react'
import {
  calculate, DEFAULT_PACE, OBJECTIVES, PACES, round, saveGoals,
  type DayMode, type Job, type Objective, type Profile, type Style, type Training,
} from '../lib/goals'
import { fmt } from '../lib/nutrition'
import { addDays, dayKey, fromKey } from '../lib/dates'
import { ObjectiveIcon, InfoIcon, BackIcon } from './Icons'

type Step = 'objetivo' | 'cuerpo' | 'actividad' | 'ritmo' | 'estilo' | 'dias' | 'resultado'

interface Props {
  initial: Profile
  onDone: () => void
  onClose: () => void
}

export function GoalWizard({ initial, onDone, onClose }: Props) {
  const [p, setP] = useState<Profile>(initial)
  const [index, setIndex] = useState(0)
  const [showHow, setShowHow] = useState(true)
  const set = (patch: Partial<Profile>) => setP((old) => ({ ...old, ...patch }))

  // "Ritmo" solo aplica cuando el objetivo cambia el peso.
  const steps: Step[] = ['objetivo', 'cuerpo', 'actividad', ...(PACES[p.objective] ? ['ritmo' as const] : []), 'estilo', 'dias', 'resultado']
  const step = steps[index]
  const questions = steps.length - 1
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1))
  const back = () => (index === 0 ? onClose() : setIndex(index - 1))
  const { goals, breakdown: b } = calculate(p)

  async function save() {
    await saveGoals(goals)
    onDone()
  }

  if (step === 'resultado') {
    const objective = OBJECTIVES.find((o) => o.id === p.objective)!
    const pace = PACES[p.objective]?.[p.pace]
    return (
      <div className="fullscreen wizard">
        <div className="wiz-top">
          <button className="icon-btn" aria-label="Atrás" onClick={back}><BackIcon /></button>
          <span>Tus metas</span>
          <span className="spacer" />
        </div>
        <section className="goal-card">
          <span className="gauge-label">{objective.label}{pace ? ` · ${pace.label}${p.objective === 'perder' ? ' por semana' : ''}` : ''}</span>
          <span className="goal-kcal">{fmt('kcal', goals.daily.kcal)} <small>kcal al día</small></span>
          {goals.high && goals.low && (
            <span className="gauge-label">
              {fmt('kcal', goals.high.kcal)} los días {p.dayMode === 'entreno' ? 'de entreno' : 'altos'} · {fmt('kcal', goals.low.kcal)} los demás
            </span>
          )}
          <div className="goal-macros">
            <div><span>Proteína</span><b>{goals.daily.protein} g</b></div>
            <div><span>Carbos</span><b>{goals.daily.carbs} g</b></div>
            <div><span>Grasa</span><b>{goals.daily.fat} g</b></div>
          </div>
        </section>

        <section className="card how">
          <div className="how-head">
            <h3>¿Cómo lo calculé?</h3>
            <button className="link" onClick={() => setShowHow(!showHow)}>{showHow ? 'Ocultar' : 'Ver'}</button>
          </div>
          {showHow && (
            <>
              <Line label="Tu cuerpo en reposo" sub={`Lo que gastas sin moverte (${b.bmrFormula})`} value={fmt('kcal', round(b.bmr, 10))} />
              <Line label="+ Tu día" sub={JOB_LABEL[p.job]} value={`+ ${fmt('kcal', round(b.base - b.bmr, 10))}`} />
              {b.steps > 0 && <Line label="+ Tus pasos" sub={`${fmt('kcal', p.steps)} pasos al día`} value={`+ ${fmt('kcal', round(b.steps, 10))}`} />}
              {b.exercise > 0 && (
                <Line label="+ Tus entrenos" sub={`${p.trainingDays} días de ${TRAINING_LABEL[p.training].toLowerCase()}, ${fmt('kcal', b.session)} kcal cada uno, repartidas en la semana`} value={`+ ${fmt('kcal', round(b.exercise, 10))}`} />
              )}
              <Line label="= Lo que gastas" sub="Para mantener tu peso" value={fmt('kcal', round(b.tdee, 10))} />
              {Math.round(b.adjustment) !== 0 && (
                <Line
                  label={b.adjustment < 0 ? '− Para tu objetivo' : '+ Para tu objetivo'}
                  sub={b.floorApplied ? 'Ajustado para no bajar del mínimo seguro' : p.objective === 'perder' ? '7.700 kcal ≈ 1 kg de grasa' : 'Superávit moderado para ganar músculo con poca grasa'}
                  value={`${b.adjustment < 0 ? '−' : '+'} ${fmt('kcal', Math.abs(round(b.adjustment, 10)))}`}
                />
              )}
              <Line strong label="Tu meta" sub={`Proteína ${fmt('protein', b.proteinPerKg)} g por kilo${b.refWeight !== p.weight ? ` (de un peso de referencia de ${Math.round(b.refWeight)} kg)` : ''}`} value={`${fmt('kcal', goals.daily.kcal)} kcal`} />
            </>
          )}
        </section>
        <Info>Es un punto de partida. Anota cómo cambia tu peso: si en 3 semanas no se mueve como esperas, recalcula o ajusta la meta.</Info>
        <div className="wiz-actions">
          <button className="primary big" onClick={save}>Guardar mis metas</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={back}><BackIcon /></button>
        <span>Paso {index + 1} de {questions}</span>
        <button className="link" onClick={next}>Saltar</button>
      </div>
      <div className="progress">{Array.from({ length: questions }, (_, i) => <span key={i} className={i <= index ? 'on' : ''} />)}</div>

      {step === 'objetivo' && (
        <>
          <Title title="¿Qué quieres lograr?" sub="Elige el que más se parezca. Puedes cambiarlo después." />
          {OBJECTIVES.map((o) => (
            <Option key={o.id} icon={<ObjectiveIcon id={o.id} />} title={o.label} sub={o.detail} on={p.objective === o.id}
              onClick={() => set({ objective: o.id, pace: DEFAULT_PACE[o.id] ?? 0 })} />
          ))}
        </>
      )}

      {step === 'cuerpo' && (
        <>
          <Title title="Cuéntame de tu cuerpo" sub="Con esto calculo cuánta energía usa tu cuerpo en reposo." />
          <Segmented options={[['hombre', 'Hombre'], ['mujer', 'Mujer']]} value={p.sex} onChange={(sex) => set({ sex })} />
          <div className="field-grid">
            <NumberField label="Edad" unit="años" value={p.age} onChange={(age) => set({ age })} />
            <NumberField label="Estatura" unit="cm" value={p.height} onChange={(height) => set({ height })} />
            <NumberField label="Peso actual" unit="kg" value={p.weight} onChange={(weight) => set({ weight })} />
            <NumberField label="Peso meta" unit="kg" hint="Opcional" value={p.targetWeight} onChange={(targetWeight) => set({ targetWeight })} />
          </div>
          <div className="card stack">
            <div className="row-between"><b>% de grasa corporal</b><span className="tag">Opcional</span></div>
            <span className="hint">Si lo sabes (báscula de bioimpedancia o medición), el cálculo es más preciso.</span>
            <NumberField label="Grasa corporal" unit="%" hint="Déjalo vacío si no lo sabes" value={p.bodyFat} onChange={(bodyFat) => set({ bodyFat })} />
          </div>
          <Info>Uso la fórmula Mifflin-St Jeor, la más recomendada para adultos (o Katch-McArdle si das tu % de grasa). Tus datos se quedan en tu teléfono.</Info>
        </>
      )}

      {step === 'actividad' && (
        <>
          <Title title="¿Cómo es tu día?" sub="Lo separo en tu trabajo y tu ejercicio, así es más exacto." />
          <div className="card">
            <h4>En tu trabajo o estudio</h4>
            {(Object.keys(JOB_LABEL) as Job[]).map((j) => (
              <button key={j} className="radio-row" onClick={() => set({ job: j })} aria-pressed={p.job === j}>
                <span><b>{JOB_TITLE[j]}</b><small>{JOB_LABEL[j]}</small></span>
                <i className={p.job === j ? 'radio on' : 'radio'} />
              </button>
            ))}
          </div>
          <div className="card stack">
            <h4>Días de ejercicio por semana</h4>
            <div className="num-pick">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} className={p.trainingDays === d ? 'on' : ''} onClick={() => set({ trainingDays: d })}>{d}</button>
              ))}
            </div>
            {p.trainingDays > 0 && (
              <>
                <Segmented options={(Object.keys(TRAINING_LABEL) as Training[]).map((t) => [t, TRAINING_LABEL[t]])} value={p.training} onChange={(training) => set({ training })} small />
                <NumberField label="Minutos por entreno" unit="min" value={p.sessionMinutes} onChange={(sessionMinutes) => set({ sessionMinutes: sessionMinutes ?? 60 })} />
              </>
            )}
          </div>
          <div className="card">
            <NumberField label="Pasos al día (promedio)" unit="pasos" hint="Míralo en Huawei Health. Más adelante lo leeremos solo." value={p.steps} onChange={(steps) => set({ steps: steps ?? 0 })} />
          </div>
        </>
      )}

      {step === 'ritmo' && <PaceStep p={p} set={set} />}

      {step === 'estilo' && (
        <>
          <Title title="¿Cómo te gusta comer?" sub="Esto decide el reparto entre proteína, carbohidratos y grasa." />
          {STYLES.map((s) => (
            <Option key={s.id} icon={<ObjectiveIcon id={s.icon} />} title={s.label} sub={s.detail} on={p.style === s.id}
              tag={s.id === 'balanceado' ? 'Sugerido' : undefined} onClick={() => set({ style: s.id })} />
          ))}
          {p.style === 'personalizado' && (
            <div className="field-grid">
              <NumberField label="Proteína" unit="g/kg" hint="Entre 1,6 y 2,2 para entrenar" value={p.proteinPerKg ?? b.proteinPerKg} onChange={(proteinPerKg) => set({ proteinPerKg })} />
              <NumberField label="Grasa" unit="g/kg" hint="Mínimo 0,6" value={p.fatPerKg ?? 0.8} onChange={(fatPerKg) => set({ fatPerKg })} />
            </div>
          )}
          <SplitPreview protein={goals.daily.protein} carbs={goals.daily.carbs} fat={goals.daily.fat} />
        </>
      )}

      {step === 'dias' && (
        <>
          <Title title="¿La misma meta todos los días?" sub="Muchos comen un poco más los días que entrenan." />
          {DAY_MODES.map((m) => (
            <Option key={m.id} icon={<ObjectiveIcon id={m.icon} />} title={m.label} sub={m.detail} on={p.dayMode === m.id}
              tag={m.id === 'entreno' && p.trainingDays > 0 ? 'Sugerido' : undefined} onClick={() => set({ dayMode: m.id })} />
          ))}
          {p.dayMode !== 'igual' && (
            <div className="card stack">
              <h4>{p.dayMode === 'entreno' ? 'Toca los días que entrenas' : 'Toca los días en que comes más'}</h4>
              <DayPicker value={p.highDays} onChange={(highDays) => set({ highDays })} />
              {goals.high && goals.low ? (
                <>
                  <div className="two-tiles">
                    <div><span>{p.dayMode === 'entreno' ? 'Día de entreno' : 'Día alto'}</span><b>{fmt('kcal', goals.high.kcal)} <small>kcal</small></b></div>
                    <div><span>{p.dayMode === 'entreno' ? 'Día de descanso' : 'Día normal'}</span><b>{fmt('kcal', goals.low.kcal)} <small>kcal</small></b></div>
                  </div>
                  <span className="hint">En la semana suma lo mismo: tu promedio sigue siendo {fmt('kcal', goals.daily.kcal)} kcal.</span>
                </>
              ) : (
                <span className="hint">Elige entre 1 y 6 días.</span>
              )}
            </div>
          )}
        </>
      )}

      <div className="wiz-actions">
        <button className="primary big" onClick={next}>{step === 'dias' ? 'Ver mis metas' : 'Continuar'}</button>
      </div>
    </div>
  )
}

function PaceStep({ p, set }: { p: Profile; set: (patch: Partial<Profile>) => void }) {
  const paces = PACES[p.objective]!
  const losing = p.objective === 'perder'
  const kg = [0.25, 0.5, 0.75, 1][p.pace] ?? 0.5
  const capped = Math.min(kg, p.weight * 0.01)
  const toLose = p.targetWeight && p.targetWeight < p.weight ? p.weight - p.targetWeight : 0
  const weeks = toLose ? Math.ceil(toLose / capped) : 0
  const arrival = weeks ? fromKey(addDays(dayKey(), weeks * 7)).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : ''
  return (
    <>
      <Title title={losing ? '¿A qué ritmo?' : '¿Qué tan rápido?'} sub={losing ? 'Cuánto peso perder por semana.' : 'Cuántas calorías ajustar frente a lo que gastas.'} />
      <div className="pace">
        {paces.map((x, i) => (
          <button key={x.label} className={p.pace === i ? 'on' : ''} onClick={() => set({ pace: i })}>
            <b>{x.label}</b><small>{x.sub}</small>
          </button>
        ))}
      </div>
      {losing && weeks > 0 && (
        <div className="card stack">
          <span className="hint">Si lo mantienes, llegarías a</span>
          <b className="big-line">{fmt('kcal', p.targetWeight!)} kg el {arrival}</b>
          <span className="hint">{weeks} semanas · comer unas {fmt('kcal', round((capped * 7700) / 7, 10))} kcal menos al día</span>
          <svg viewBox="0 0 318 90" className="pace-chart" aria-hidden="true">
            <path d="M10 15 C 110 32, 200 62, 306 74 L306 88 L10 88 Z" className="area" />
            <path d="M10 15 C 110 32, 200 62, 306 74" className="line" />
            <circle cx="10" cy="15" r="5" className="dot-start" />
            <circle cx="306" cy="74" r="6" className="dot-end" />
          </svg>
        </div>
      )}
      {losing && capped < kg && <Info>Ese ritmo es más del 1 % de tu peso por semana; lo limité a {fmt('protein', capped)} kg para cuidar tu músculo.</Info>}
      <Info>
        {losing
          ? 'Bajar más del 1 % de tu peso por semana suele costar músculo y energía. Con 0,5 kg vas firme y sin pasar hambre.'
          : p.objective === 'ganar'
            ? 'Un superávit moderado (unas 300 kcal) gana músculo con poca grasa. Más rápido no hace crecer más músculo.'
            : 'Un déficit pequeño permite bajar grasa sin frenar la ganancia de músculo, siempre que entrenes fuerza.'}
      </Info>
      {losing && <div className="warn"><InfoIcon />Nunca te propondré menos de {p.sex === 'hombre' ? '1.500' : '1.200'} kcal al día. Por debajo de eso, mejor con un profesional.</div>}
    </>
  )
}

const JOB_TITLE: Record<Job, string> = { sentado: 'Sentado casi todo el día', 'de-pie': 'De pie o caminando', fisico: 'Trabajo físico' }
const JOB_LABEL: Record<Job, string> = { sentado: 'Oficina, computador, conducir', 'de-pie': 'Comercio, docencia, enfermería', fisico: 'Construcción, campo, cargar peso' }
const TRAINING_LABEL: Record<Training, string> = { pesas: 'Pesas', cardio: 'Cardio', mixto: 'Mixto' }
const STYLES: { id: Style; label: string; detail: string; icon: Objective | 'check' | 'sliders' }[] = [
  { id: 'balanceado', label: 'Balanceado', detail: 'Lo más fácil de sostener. Proteína alta para tu objetivo.', icon: 'check' },
  { id: 'alto-carbos', label: 'Alto en carbohidratos', detail: 'Para entrenos largos o deportes de resistencia.', icon: 'rendimiento' },
  { id: 'bajo-carbos', label: 'Bajo en carbohidratos', detail: 'Si te sientes mejor con menos arroz, pan y arepa.', icon: 'perder' },
  { id: 'personalizado', label: 'Personalizado', detail: 'Tú eliges los gramos de proteína y grasa por kilo.', icon: 'sliders' },
]
const DAY_MODES: { id: DayMode; label: string; detail: string; icon: Objective | 'sliders' }[] = [
  { id: 'igual', label: 'Igual todos los días', detail: 'Lo más simple: una sola meta.', icon: 'mantener' },
  { id: 'entreno', label: 'Entreno y descanso', detail: 'Más carbohidratos cuando entrenas, menos cuando descansas.', icon: 'rendimiento' },
  { id: 'semana', label: 'Por día de la semana', detail: 'Por ejemplo, un poco más los fines de semana.', icon: 'sliders' },
]

function Title({ title, sub }: { title: string; sub: string }) {
  return <div className="wiz-title"><h1>{title}</h1><span>{sub}</span></div>
}

export function Info({ children }: { children: ReactNode }) {
  return <div className="info"><InfoIcon /><span>{children}</span></div>
}

function Line({ label, sub, value, strong }: { label: string; sub: string; value: string; strong?: boolean }) {
  return <div className={strong ? 'how-line strong' : 'how-line'}><span><b>{label}</b><small>{sub}</small></span><b>{value}</b></div>
}

export function Option({ icon, title, sub, on, tag, onClick }: { icon: ReactNode; title: string; sub: string; on: boolean; tag?: string; onClick: () => void }) {
  return (
    <button className={on ? 'option on' : 'option'} onClick={onClick} aria-pressed={on}>
      <span className="option-icon">{icon}</span>
      <span className="option-text"><b>{title}{tag && <span className="tag">{tag}</span>}</b><small>{sub}</small></span>
    </button>
  )
}

export function Segmented<T extends string>({ options, value, onChange, small }: { options: [T, string][]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={small ? 'segmented small' : 'segmented'}>
      {options.map(([id, label]) => <button key={id} className={id === value ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  )
}

// Campo numérico que acepta coma decimal y puede quedar vacío.
export function NumberField({ label, unit, hint, value, onChange }: { label: string; unit: string; hint?: string; value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','))
  return (
    <label className="num-field">
      <span>{label}</span>
      <span className="num-input">
        <input inputMode="decimal" value={text} placeholder="—" onChange={(e) => {
          setText(e.target.value)
          const n = parseFloat(e.target.value.replace(',', '.'))
          onChange(Number.isFinite(n) && n > 0 ? n : undefined)
        }} />
        <small>{unit}</small>
      </span>
      {hint && <small className="num-hint">{hint}</small>}
    </label>
  )
}

export function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="day-pick">
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
        <button key={i} className={value.includes(i) ? 'on' : ''} aria-pressed={value.includes(i)}
          aria-label={['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort())}>
          <small>{d}</small>
        </button>
      ))}
    </div>
  )
}

export function SplitPreview({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9 || 1
  const pct = (g: number, k: number) => `${(g * k / total) * 100}%`
  return (
    <div className="card stack">
      <h4>Así queda tu reparto</h4>
      <div className="macro-bar tall">
        <div className="protein" style={{ width: pct(protein, 4) }} />
        <div className="carbs" style={{ width: pct(carbs, 4) }} />
        <div className="fat" style={{ width: pct(fat, 9) }} />
      </div>
      <div className="row-between small-text"><span>Proteína {protein} g</span><span>Carbos {carbs} g</span><span>Grasa {fat} g</span></div>
    </div>
  )
}
