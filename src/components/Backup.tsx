// Guardar una copia de tus datos y recuperarla (en Tu perfil y en la bienvenida).
import { useRef, useState } from 'react'
import { lastBackup, readBackup, useHasData, restoreBackup, saveBackup, type BackupSummary } from '../lib/backup'
import { Info } from './GoalWizard'

const when = (t: number) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
const agoText = (t: number | null) => {
  if (!t) return 'Aún no has guardado ninguna copia.'
  const days = Math.floor((Date.now() - t) / 86400000)
  return `Última copia: ${days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`}.`
}

export function BackupSection() {
  const [last, setLast] = useState(lastBackup)
  const [msg, setMsg] = useState('')
  async function save() {
    setMsg('')
    if (await saveBackup()) { setLast(lastBackup()); setMsg('Copia guardada. Déjala en un lugar seguro, como iCloud Drive o tu correo.') }
  }
  return (
    <div className="chip-group">
      <h4>Tus datos</h4>
      <div className="card stack">
        <b>Copia de seguridad</b>
        <span className="hint">Todo se guarda solo en este teléfono. Guarda una copia para no perderlo si lo cambias o borras la app.</span>
        <span className="hint small">{agoText(last)}</span>
        <button className="primary" onClick={save}>Guardar una copia</button>
        <RestoreButton />
      </div>
      {msg && <Info>{msg}</Info>}
    </div>
  )
}

// Elegir el archivo, ver qué trae y confirmar.
export function RestoreButton({ label = 'Recuperar una copia' }: { label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: Parameters<typeof restoreBackup>[0]; summary: BackupSummary } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    setError('')
    if (!file) return
    try { setPending(await readBackup(file)) } catch (e) { setError((e as Error).message) }
    if (input.current) input.current.value = ''
  }
  async function restore() {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(pending.data)
      setPending(null)
    } catch {
      setError('No pude recuperar la copia. Tus datos de antes siguen como estaban.')
    }
    setBusy(false)
  }

  const s = pending?.summary
  return (
    <>
      <input ref={input} type="file" accept="application/json,.json" hidden aria-label="Archivo de la copia" onChange={(e) => pick(e.target.files?.[0])} />
      <button className="link small-link center" onClick={() => input.current?.click()}>{label}</button>
      {error && <div className="warn">{error}</div>}
      {s && (
        <div className="overlay" onClick={() => setPending(null)}>
          <div className="bottom-sheet" role="dialog" aria-label="Recuperar copia" onClick={(e) => e.stopPropagation()}>
            <span className="grabber" />
            <div className="qs-head"><h2>¿Recuperar esta copia?</h2><button className="close" aria-label="Cerrar" onClick={() => setPending(null)}>×</button></div>
            <div className="card stack">
              <b>Copia del {when(s.exportedAt)}</b>
              <span className="hint">{s.entries} comidas anotadas · {s.weights} pesos · {s.routines} rutinas · {s.workouts} entrenos · {s.foods} alimentos tuyos</span>
            </div>
            <div className="warn">Reemplaza todo lo que hay ahora en este teléfono por lo de la copia.</div>
            <button className="primary big" disabled={busy} onClick={restore}>{busy ? 'Recuperando…' : 'Sí, recuperar'}</button>
          </div>
        </div>
      )}
    </>
  )
}

// Un recordatorio suave en Metas si tienes datos y hace mucho no guardas copia.
export function BackupNudge() {
  const count = useHasData()
  const [last, setLast] = useState(lastBackup)
  const [hidden, setHidden] = useState(false)
  const [now] = useState(() => Date.now())
  const old = !last || now - last > 30 * 86400000
  if (hidden || !count || count < 20 || !old) return null
  return (
    <div className="card stack">
      <b>Guarda una copia de tus datos</b>
      <span className="hint">{last ? agoText(last) : 'Todo vive solo en este teléfono.'} Si lo cambias o borras la app, con la copia lo recuperas.</span>
      <div className="two-buttons">
        <button className="secondary" onClick={() => setHidden(true)}>Ahora no</button>
        <button className="primary" onClick={async () => { if (await saveBackup()) setLast(lastBackup()) }}>Guardar copia</button>
      </div>
    </div>
  )
}
