// Respaldo: todo lo que guardas en un archivo, para no perderlo si cambias de
// teléfono o borras la app. El archivo es JSON (texto) y se puede abrir con cualquier editor.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { dayKey } from './dates'

const APP = 'seguimiento-fit'
const TABLES = ['foods', 'entries', 'settings', 'weights', 'plans', 'menus', 'routines', 'workouts', 'cardio'] as const
type Table = (typeof TABLES)[number]

interface BackupFile {
  app: typeof APP
  version: number // versión de la base cuando se guardó
  exportedAt: number
  tables: Partial<Record<Table, unknown[]>>
}

// Cuándo guardaste la última copia (no viaja dentro del archivo).
const LAST = 'seguimiento-fit:ultima-copia'
export function lastBackup(): number | null {
  try { return Number(localStorage.getItem(LAST)) || null } catch { return null }
}

export async function makeBackup(): Promise<Blob> {
  const tables: BackupFile['tables'] = {}
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray()
  })
  const file: BackupFile = { app: APP, version: db.verno, exportedAt: Date.now(), tables }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

// Guarda la copia: en el iPhone abre "Compartir" (Guardar en Archivos, iCloud, WhatsApp…);
// si no se puede, la descarga. Devuelve false si cancelaste.
export async function saveBackup(): Promise<boolean> {
  const blob = await makeBackup()
  const name = `seguimiento-fit-${dayKey()}.json`
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia de Seguimiento Fit' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      download(blob, name)
    }
  } else {
    download(blob, name)
  }
  try { localStorage.setItem(LAST, String(Date.now())) } catch { /* sin almacenamiento: no pasa nada */ }
  return true
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Lo que trae un archivo, para mostrarlo antes de recuperarlo.
export interface BackupSummary { exportedAt: number; entries: number; weights: number; workouts: number; routines: number; foods: number }

export async function readBackup(file: File): Promise<{ data: BackupFile; summary: BackupSummary }> {
  let data: BackupFile
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Ese archivo no es una copia de Seguimiento Fit.')
  }
  if (data?.app !== APP || typeof data.tables !== 'object') throw new Error('Ese archivo no es una copia de Seguimiento Fit.')
  if (data.version > db.verno) throw new Error('Esa copia es de una versión más nueva de la app. Actualiza la app (ciérrala y ábrela) y vuelve a intentar.')
  const n = (t: Table) => (Array.isArray(data.tables[t]) ? data.tables[t]!.length : 0)
  return { data, summary: { exportedAt: data.exportedAt, entries: n('entries'), weights: n('weights'), workouts: n('workouts'), routines: n('routines'), foods: n('foods') } }
}

// Reemplaza todo lo del teléfono por lo de la copia, de una sola vez (si algo falla, no cambia nada).
export async function restoreBackup(data: BackupFile) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = data.tables[t]
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkAdd(rows)
    }
  })
}

// ¿Hay suficiente guardado como para que valga la pena recordarte la copia?
export const useHasData = () => useLiveQuery(async () => (await db.entries.count()) + (await db.weights.count()) + (await db.workouts.count()), [])
