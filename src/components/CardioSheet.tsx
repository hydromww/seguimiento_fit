// Anotar cardio: tipo, minutos e intensidad; la app calcula las calorías.
import { useEffect, useState } from 'react'
import type { Intensity } from '../lib/db'
import { dayKey } from '../lib/dates'
import { bodyKg, CARDIO_TYPES, cardioKcal, saveCardio } from '../lib/training'

const LEVELS: { id: Intensity; label: string; sub: string }[] = [
  { id: 'suave', label: 'Suave', sub: 'puedes cantar' },
  { id: 'moderado', label: 'Moderado', sub: 'puedes hablar' },
  { id: 'fuerte', label: 'Fuerte', sub: 'casi no hablas' },
]

export function CardioSheet({ minutes: initialMinutes, onClose }: { minutes: number; onClose: () => void }) {
  const [type, setType] = useState('caminar')
  const [minutes, setMinutes] = useState(initialMinutes)
  const [intensity, setIntensity] = useState<Intensity>('moderado')
  const [kg, setKg] = useState(70)
  useEffect(() => { bodyKg().then(setKg) }, [])
  const kcal = cardioKcal(type, intensity, minutes, kg)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="bottom-sheet" role="dialog" aria-label="Anotar cardio" onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <div className="qs-head"><h2>Anotar cardio</h2><button className="close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        <div className="chips">
          {CARDIO_TYPES.map((t) => <button key={t.id} className={type === t.id ? 'chip cardio-on' : 'chip'} aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
        </div>
        <div className="card stepper">
          <button aria-label="Menos minutos" onClick={() => setMinutes((m) => Math.max(5, m - 5))}>−</button>
          <span className="stepper-value"><b>{minutes}</b><small>minutos</small></span>
          <button aria-label="Más minutos" onClick={() => setMinutes((m) => Math.min(300, m + 5))}>+</button>
        </div>
        <div className="kind-pick">
          {LEVELS.map((l) => <button key={l.id} className={intensity === l.id ? 'on' : ''} onClick={() => setIntensity(l.id)}>{l.label}<small>{l.sub}</small></button>)}
        </div>
        <div className="card row-between"><span className="hint">Gastaste más o menos</span><b className="big-num">≈ {kcal} kcal</b></div>
        <button className="primary big" onClick={async () => { await saveCardio({ date: dayKey(), type, minutes, intensity, kcal, createdAt: Date.now() }); onClose() }}>Guardar</button>
      </div>
    </div>
  )
}
