// La introducción: la primera vez que abres la app te pregunta tu nombre, tus metas,
// lo que hay que cuidar, cómo entrenas y qué comes, y te deja todo armado.
import { useState } from 'react'
import { DEFAULT_PROFILE, PACES, trainingDays, upgradeProfile, useGoals, type Goals, type Profile } from '../lib/goals'
import { savePerfil, usePerfil, type Perfil } from '../lib/perfil'
import { careNotes, healthNotes, HEALTH, INJURIES, LEVELS } from '../lib/conditions'
import { PLACES, type Place } from '../lib/exercises'
import { useTrainingPrefs } from '../lib/training'
import { usePrefs } from '../lib/plans'
import { EXCLUSIONS, type Exclusion } from '../lib/pantry'
import { PANTRY_UNITS, STARTER } from '../lib/candidates'
import { normalize } from '../lib/icbf'
import { fmt } from '../lib/nutrition'
import { buildAll, INTRO_PANTRY, type Built } from '../lib/onboarding'
import { GoalQuestion, NumberField, Segmented, WeekLine, type Question } from './GoalWizard'
import { RestoreButton } from './Backup'
import { BackIcon, CheckIcon, DumbbellIcon, GoalIcon, HeartIcon, TodayIcon } from './Icons'

type Step = 'hola' | 'tu' | Exclude<Question, 'cuerpo' | 'dias'> | 'cuidar' | 'entrenas' | 'comida' | 'listo'
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const PLACE_TEXT: Record<Place, string> = { gimnasio: 'gimnasio', casa: 'en casa', corporal: 'sin equipo' }

export function Onboarding() {
  const goals = useGoals()
  const perfil = usePerfil()
  const training = useTrainingPrefs()
  const prefs = usePrefs()
  if (goals === undefined || !perfil || !training || !prefs) return null
  return <Intro goals={goals} perfil={perfil} place={training.place} selected={prefs.selected} exclusions={prefs.exclusions} />
}

function Intro({ goals, perfil: initialPerfil, place: initialPlace, selected: initialSelected, exclusions: initialExclusions }: {
  goals: Goals | null; perfil: Perfil; place: Place; selected: string[]; exclusions: Exclusion[]
}) {
  const [perfil, setPerfil] = useState<Perfil>(initialPerfil)
  const [p, setP] = useState<Profile>(goals?.profile ? upgradeProfile(goals.profile) : DEFAULT_PROFILE)
  const [place, setPlace] = useState<Place>(initialPlace)
  const [selected, setSelected] = useState<string[]>(initialSelected.length ? initialSelected : STARTER)
  const [exclusions, setExclusions] = useState<Exclusion[]>(initialExclusions)
  const [index, setIndex] = useState(0)
  const [built, setBuilt] = useState<Built | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Profile>) => setP((old) => ({ ...old, ...patch }))
  const care = (patch: Partial<Perfil>) => setPerfil((old) => ({ ...old, ...patch }))

  const steps: Step[] = ['hola', 'tu', 'objetivo', 'actividad', ...(PACES[p.objective] ? ['ritmo' as const] : []), 'estilo', 'cuidar', 'entrenas', 'comida', 'listo']
  const step = steps[index]
  const questions = steps.length - 2 // sin la bienvenida ni el resumen
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))
  const name = perfil.name.trim().split(' ')[0]

  async function build() {
    setBusy(true)
    // Si ya tenías metas, se respeta cómo repartías los días; si no, más comida los días que entrenas.
    const profile: Profile = goals?.profile ? p : { ...p, dayMode: trainingDays(p).length && trainingDays(p).length < 7 ? 'entreno' : 'igual' }
    setBuilt(await buildAll({ perfil, profile, place, selected, exclusions, previous: goals }))
    setBusy(false)
    next()
  }

  if (step === 'hola') {
    return (
      <div className="fullscreen wizard intro">
        <span className="intro-logo"><HeartIcon size={34} /></span>
        <h1 className="intro-brand">Seguimiento<br />Fit</h1>
        <span className="intro-lead">Te hago unas preguntas y te dejo todo listo: tus metas de comida, tu menú de la semana y tu rutina de entreno.</span>
        <div className="intro-points">
          <span><i><GoalIcon /></i>Tus calorías y macros, calculadas para ti</span>
          <span><i><TodayIcon /></i>Un menú variado que se arma solo</span>
          <span><i><DumbbellIcon /></i>Una rutina que cuida tus lesiones</span>
        </div>
        <span className="hint small">Unos 3 minutos. Todo se guarda solo en tu teléfono.</span>
        <div className="wiz-actions">
          <button className="primary big" onClick={next}>Empezar</button>
          {goals && <button className="link small-link center" onClick={() => savePerfil({ ...perfil, done: true })}>Ahora no, ya tengo mis datos</button>}
          <RestoreButton label="¿Cambiaste de teléfono? Recupera tu copia" />
        </div>
      </div>
    )
  }

  if (step === 'listo' && built) {
    const notes = [...careNotes(perfil.injuries, place), ...healthNotes(perfil.health)]
    const r = built.routines
    return (
      <div className="fullscreen wizard">
        <span className="done-badge"><CheckIcon /></span>
        <div className="wiz-title"><h1>Listo{name ? `, ${name}` : ''}.<br />Esto es lo que te armé</h1></div>
        <div className="card built">
          <div className="built-row">
            <i><GoalIcon /></i>
            <span><b>Tus metas</b><small>{fmt('kcal', built.goals.daily.kcal)} kcal al día · {built.goals.daily.protein} g de proteína</small>{built.goals.week && <small><WeekLine goals={built.goals} /></small>}</span>
          </div>
          <div className="built-row">
            <i><TodayIcon /></i>
            <span><b>Tu menú de esta semana</b><small>{built.menu ? '7 días con platos distintos, con lo que tienes en casa' : 'Faltan alimentos para armarlo: agrega una proteína y un carbohidrato en Planes'}</small></span>
          </div>
          <div className="built-row">
            <i><DumbbellIcon /></i>
            <span><b>Tu rutina</b><small>{r.length
              ? `${[...new Set(r.map((x) => x.name.replace(/ [BC]$/, '')))].join(', ')} · ${r.length} ${r.length === 1 ? 'día' : 'días'} · ${p.weightsMinutes} min · ${PLACE_TEXT[place]}`
              : 'No marcaste días de pesas. Ármala cuando quieras en Entreno.'}</small></span>
          </div>
        </div>
        {notes.map((n) => <div key={n} className="warn">{n}</div>)}
        <span className="hint small">Todo lo puedes cambiar después en Metas, Planes, Entreno y Tu perfil.</span>
        <div className="wiz-actions"><button className="primary big" onClick={() => savePerfil({ ...perfil, name: perfil.name.trim(), done: true })}>Entrar a la app</button></div>
      </div>
    )
  }

  const shown = index // la bienvenida no cuenta como paso
  const pantry = INTRO_PANTRY.filter((code) => {
    const item = PANTRY_UNITS.get(code)
    return item && !EXCLUSIONS.some((e) => exclusions.includes(e.id) && e.test(normalize(item.label), code))
  })
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={back}><BackIcon /></button>
        <span>Paso {shown} de {questions}</span>
        <span className="spacer" />
      </div>
      <div className="progress">{Array.from({ length: questions }, (_, i) => <span key={i} className={i < shown ? 'on' : ''} />)}</div>

      {step === 'tu' && (
        <>
          <div className="wiz-title"><h1>¿Cómo te llamas?</h1><span>Así te saludo en la app.</span></div>
          <label className="field"><span>Tu nombre</span><input value={perfil.name} placeholder="Tu nombre" autoComplete="given-name" onChange={(e) => care({ name: e.target.value })} /></label>
          <div className="stack-tight">
            <span className="field-label">Sexo</span>
            <Segmented options={[['hombre', 'Hombre'], ['mujer', 'Mujer']]} value={p.sex} onChange={(sex) => set({ sex })} />
            <span className="hint small">Solo para calcular tu gasto de energía.</span>
          </div>
          <div className="field-grid three">
            <NumberField label="Edad" unit="años" value={p.age} onChange={(age) => set({ age: age ?? p.age })} />
            <NumberField label="Estatura" unit="cm" value={p.height} onChange={(height) => set({ height: height ?? p.height })} />
            <NumberField label="Peso" unit="kg" value={p.weight} onChange={(weight) => set({ weight: weight ?? p.weight })} />
          </div>
          <NumberField label="Peso meta" unit="kg" hint="Opcional" value={p.targetWeight} onChange={(targetWeight) => set({ targetWeight })} />
        </>
      )}

      {(step === 'objetivo' || step === 'actividad' || step === 'ritmo' || step === 'estilo') && (
        <GoalQuestion step={step} p={p} set={set} name={name} />
      )}

      {step === 'cuidar' && (
        <>
          <div className="wiz-title"><h1>¿Algo que cuidar?</h1><span>Lesiones o dolores que deba tener en cuenta en tu rutina. Si no tienes, sigue.</span></div>
          <div className="care-grid">
            {INJURIES.map((i) => (
              <button key={i.id} className={perfil.injuries.includes(i.id) ? 'on' : ''} aria-pressed={perfil.injuries.includes(i.id)}
                onClick={() => care({ injuries: toggle(perfil.injuries, i.id) })}>
                <b>{i.label}</b><small>{i.sub}</small>
              </button>
            ))}
          </div>
          <div className="chip-group">
            <h4>Salud</h4>
            <div className="chips">
              {HEALTH.map((h) => (
                <button key={h.id} className={perfil.health.includes(h.id) ? 'chip on' : 'chip'} aria-pressed={perfil.health.includes(h.id)}
                  onClick={() => care({ health: toggle(perfil.health, h.id) })}>{h.label}</button>
              ))}
            </div>
          </div>
          {[...careNotes(perfil.injuries, place), ...healthNotes(perfil.health)].map((n) => <div key={n} className="warn">{n}</div>)}
          <span className="hint small center-text">Esto no reemplaza a un médico o fisioterapeuta.</span>
        </>
      )}

      {step === 'entrenas' && (
        <>
          <div className="wiz-title"><h1>¿Cómo entrenas?</h1><span>Para saber con qué empezar.</span></div>
          <div className="card">
            {LEVELS.map((l) => (
              <button key={l.id} className="radio-row" onClick={() => care({ level: l.id })} aria-pressed={perfil.level === l.id}>
                <span><b>{l.label}</b><small>{l.sub}</small></span>
                <i className={perfil.level === l.id ? 'radio on' : 'radio'} />
              </button>
            ))}
          </div>
          <div className="stack-tight">
            <span className="field-label">¿Dónde entrenas?</span>
            <div className="kind-pick">
              {PLACES.map((x) => <button key={x.id} className={place === x.id ? 'on' : ''} aria-pressed={place === x.id} onClick={() => setPlace(x.id)}>{x.label}<small>{x.sub}</small></button>)}
            </div>
          </div>
          {p.weightsDays.length > 0 && <span className="hint small">Tus días de pesas: {p.weightsDays.map((d) => DAY_NAMES[d]).join(', ')}, {p.weightsMinutes} minutos.</span>}
        </>
      )}

      {step === 'comida' && (
        <>
          <div className="wiz-title"><h1>¿Y en la comida?</h1><span>Para tu menú de la semana. Luego puedes cambiarlo en Planes.</span></div>
          <div className="chip-group">
            <h4>¿Algo que no comes?</h4>
            <div className="chips">
              {EXCLUSIONS.map((e) => (
                <button key={e.id} className={exclusions.includes(e.id) ? 'chip on' : 'chip'} aria-pressed={exclusions.includes(e.id)}
                  onClick={() => setExclusions(toggle<Exclusion>(exclusions, e.id))}>{e.label}</button>
              ))}
            </div>
          </div>
          <div className="chip-group">
            <h4>Lo que sueles tener en casa</h4>
            <div className="chips">
              {pantry.map((code) => (
                <button key={code} className={selected.includes(code) ? 'chip on' : 'chip'} aria-pressed={selected.includes(code)}
                  onClick={() => setSelected(toggle(selected, code))}>{PANTRY_UNITS.get(code)!.label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="wiz-actions">
        {step === 'comida'
          ? <button className="primary big" disabled={busy} onClick={build}>{busy ? 'Armando…' : 'Armar todo'}</button>
          : <button className="primary big" onClick={next}>Continuar</button>}
      </div>
    </div>
  )
}
