// Tu perfil: tu nombre y lo que contaste en la introducción (lo que hay que cuidar
// y tu experiencia). Se guarda en el teléfono y lo cambias en "Tu perfil".
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Health, Injury, Level } from './conditions'

export interface Perfil {
  name: string
  injuries: Injury[]
  health: Health[]
  level: Level
  done: boolean // ya pasó por la introducción
}

export const DEFAULT_PERFIL: Perfil = { name: '', injuries: [], health: [], level: 'algo', done: false }

export const loadPerfil = async (): Promise<Perfil> =>
  ({ ...DEFAULT_PERFIL, ...(((await db.settings.get('perfil'))?.value as Partial<Perfil> | undefined) ?? {}) })
export const savePerfil = (p: Perfil) => db.settings.put({ key: 'perfil', value: p })
export const usePerfil = () => useLiveQuery(loadPerfil, [])

// "Hola, Juan" o solo "Hola" si aún no nos dijiste tu nombre.
export const hola = (p: Perfil | undefined) => (p?.name ? `Hola, ${p.name.split(' ')[0]}` : 'Hola')
