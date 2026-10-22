// La introducción: con lo que respondes te dejamos todo listo de una vez
// (metas, rutina y menú de la semana).
import type { Routine } from './db'
import { dayKey } from './dates'
import { calculate, saveGoals, type Goals, type Profile } from './goals'
import { generate, replaceRoutines, saveTrainingPrefs } from './training'
import { createMenu, mondayOf } from './menu'
import { loadPrefs, savePrefs } from './plans'
import { careOf } from './conditions'
import { savePerfil, type Perfil } from './perfil'
import type { Place } from './exercises'
import type { Exclusion } from './pantry'

// Los alimentos que mostramos en "Lo que sueles tener en casa" (códigos ICBF).
export const INTRO_PANTRY = [
  'J003', 'F086', 'F104', 'E004', 'E043', 'F020', 'G017', 'T025',
  'A009', 'A005', 'B067', 'A012', 'T010', 'B088', 'A073',
  'C010', 'C054', 'B103', 'B059', 'B025', 'C001', 'G012',
]

export interface Answers {
  perfil: Perfil
  profile: Profile
  place: Place
  selected: string[]
  exclusions: Exclusion[]
  previous?: Goals | null // tus metas de antes, para no perder lo aprendido en tus revisiones
}

export interface Built {
  goals: Goals
  routines: Omit<Routine, 'id'>[]
  menu: boolean // false si con esos alimentos no alcanzó para armar el menú
}

export async function buildAll(a: Answers): Promise<Built> {
  const { goals } = calculate(a.profile)
  if (a.previous?.reviewedAt) goals.reviewedAt = a.previous.reviewedAt
  await saveGoals(goals)
  await saveTrainingPrefs({ place: a.place })
  const p = a.profile
  const routines = p.weightsDays.length
    ? generate({ days: p.weightsDays, minutes: p.weightsMinutes, place: a.place, objective: p.objective, care: careOf(a.perfil) })
    : []
  if (routines.length) await replaceRoutines(routines)
  await savePrefs({ ...(await loadPrefs()), selected: a.selected, exclusions: a.exclusions })
  const menu = await createMenu(mondayOf(dayKey()))
  // "done" queda en true al tocar "Entrar a la app", después de ver el resumen.
  await savePerfil({ ...a.perfil, name: a.perfil.name.trim(), done: false })
  return { goals, routines, menu }
}
