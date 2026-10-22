// "Tu perfil": tu nombre, lo que hay que cuidar, tu experiencia, dónde entrenas y lo
// que no comes. Si cambias algo que afecta tu rutina o tu menú, te ofrezco rehacerlos.
import { useState } from 'react'
import { upgradeProfile, useGoals } from '../lib/goals'
import { savePerfil, usePerfil, type Perfil } from '../lib/perfil'
import { careOf, HEALTH, INJURIES, LEVELS } from '../lib/conditions'
import { PLACES, type Place } from '../lib/exercises'
import { generate, replaceRoutines, saveTrainingPrefs, useRoutines, useTrainingPrefs } from '../lib/training'
import { savePrefs, usePrefs } from '../lib/plans'
import { EXCLUSIONS, type Exclusion } from '../lib/pantry'
import { createMenu, mondayOf } from '../lib/menu'
import { dayKey } from '../lib/dates'
import { Info } from './GoalWizard'
import { BackIcon } from './Icons'

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

export function ProfileScreen({ onClose }: { onClose: () => void }) {
  const perfil = usePerfil()
  const goals = useGoals()
  const training = useTrainingPrefs()
  const prefs = usePrefs()
  const routines = useRoutines()
  const [changed, setChanged] = useState<'' | 'rutina' | 'menu'>('')
  const [done, setDone] = useState('')
  const [confirm, setConfirm] = useState(false)
  if (!perfil || goals === undefined || !training || !prefs || !routines) return null

  const p = goals?.profile ? upgradeProfile(goals.profile) : undefined
  const update = (patch: Partial<Perfil>, affects?: 'rutina') => {
    savePerfil({ ...perfil, ...patch })
    if (affects) { setChanged(affects); setDone('') }
  }
  const setPlace = (place: Place) => { saveTrainingPrefs({ ...training, place }); setChanged('rutina'); setDone('') }
  const setExclusions = (exclusions: Exclusion[]) => { savePrefs({ ...prefs, exclusions }); setChanged('menu'); setDone('') }

  async function regenerate() {
    if (!p) return
    await replaceRoutines(generate({ days: p.weightsDays, minutes: p.weightsMinutes, place: training!.place, objective: p.objective, care: careOf(perfil) }))
    setChanged(''); setDone('Listo, tu rutina ya está al día. Tus entrenos pasados no se borran.')
  }
  async function remakeMenu() {
    const ok = await createMenu(mondayOf(dayKey()), Date.now() % 100000)
    setChanged(''); setDone(ok ? 'Listo, rehice el menú de esta semana.' : 'Con lo que quitaste no alcanza para el menú: agrega alimentos en Planes.')
  }

  return (
    <div className="fullscreen wizard">
      <div className="wiz-top">
        <button className="icon-btn" aria-label="Atrás" onClick={onClose}><BackIcon /></button>
        <span className="plan-title">Tu perfil</span>
        <span className="spacer" />
      </div>
      <div className="profile-head">
        <span className="avatar big">{perfil.name.trim()[0]?.toUpperCase() ?? '?'}</span>
        <span><b>{perfil.name.trim() || 'Sin nombre'}</b>{p && <small>{p.sex === 'hombre' ? 'Hombre' : 'Mujer'} · {p.age} años · {p.height} cm</small>}</span>
      </div>

      <NameField initial={perfil.name} onSave={(name) => update({ name })} />

      <div className="chip-group">
        <h4>Lo que cuidar</h4>
        <div className="care-grid">
          {INJURIES.map((i) => (
            <button key={i.id} className={perfil.injuries.includes(i.id) ? 'on' : ''} aria-pressed={perfil.injuries.includes(i.id)}
              onClick={() => update({ injuries: toggle(perfil.injuries, i.id) }, 'rutina')}>
              <b>{i.label}</b><small>{i.sub}</small>
            </button>
          ))}
        </div>
        <div className="chips">
          {HEALTH.map((h) => (
            <button key={h.id} className={perfil.health.includes(h.id) ? 'chip on' : 'chip'} aria-pressed={perfil.health.includes(h.id)}
              onClick={() => update({ health: toggle(perfil.health, h.id) }, 'rutina')}>{h.label}</button>
          ))}
        </div>
      </div>

      <div className="chip-group">
        <h4>Experiencia</h4>
        <div className="card">
          {LEVELS.map((l) => (
            <button key={l.id} className="radio-row" onClick={() => update({ level: l.id }, 'rutina')} aria-pressed={perfil.level === l.id}>
              <span><b>{l.label}</b><small>{l.sub}</small></span>
              <i className={perfil.level === l.id ? 'radio on' : 'radio'} />
            </button>
          ))}
        </div>
      </div>

      <div className="chip-group">
        <h4>Dónde entrenas</h4>
        <div className="kind-pick">
          {PLACES.map((x) => <button key={x.id} className={training.place === x.id ? 'on' : ''} aria-pressed={training.place === x.id} onClick={() => setPlace(x.id)}>{x.label}<small>{x.sub}</small></button>)}
        </div>
      </div>

      <div className="chip-group">
        <h4>Lo que no comes</h4>
        <div className="chips">
          {EXCLUSIONS.map((e) => (
            <button key={e.id} className={prefs.exclusions.includes(e.id) ? 'chip on' : 'chip'} aria-pressed={prefs.exclusions.includes(e.id)}
              onClick={() => setExclusions(toggle<Exclusion>(prefs.exclusions, e.id))}>{e.label}</button>
          ))}
        </div>
      </div>

      {changed === 'rutina' && p && p.weightsDays.length > 0 && (
        <div className="card stack">
          <b>¿Rehago tu rutina con estos cambios?</b>
          <span className="hint">{routines.length ? `Reemplaza tus ${routines.length} rutinas. ` : ''}Tus entrenos pasados y tu progreso no se borran.</span>
          <button className="primary" onClick={regenerate}>Rehacer mi rutina</button>
        </div>
      )}
      {changed === 'menu' && (
        <div className="card stack">
          <b>¿Rehago el menú de esta semana?</b>
          <span className="hint">Si no, los cambios se notan desde el próximo lunes.</span>
          <button className="primary" onClick={remakeMenu}>Rehacer el menú</button>
        </div>
      )}
      {done && <Info>{done}</Info>}
      <span className="hint small">Tus metas de comida se cambian en Metas.</span>

      {confirm ? (
        <div className="card stack">
          <b>¿Volver a la introducción?</b>
          <span className="hint">Te pregunto todo otra vez y rehago tus metas, tu rutina y tu menú. Tu diario, tu peso y tus entrenos no se borran.</span>
          <button className="primary danger-fill" onClick={() => savePerfil({ ...perfil, done: false })}>Sí, empezar de cero</button>
          <button className="link" onClick={() => setConfirm(false)}>Cancelar</button>
        </div>
      ) : (
        <button className="link danger-link" onClick={() => setConfirm(true)}>Empezar de cero</button>
      )}
    </div>
  )
}

// El nombre se escribe en el campo y se guarda mientras escribes.
function NameField({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  return <label className="field"><span>Tu nombre</span><input value={name} placeholder="Tu nombre" onChange={(e) => { setName(e.target.value); onSave(e.target.value) }} /></label>
}
