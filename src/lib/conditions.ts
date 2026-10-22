// Lo que hay que cuidar al entrenar: lesiones o dolores, temas de salud y tu experiencia.
//
// En qué nos basamos (detalle en COMO-FUNCIONA.md):
// - Con una zona adolorida se evitan los ejercicios que más la cargan y se cambian por
//   otros del mismo músculo que la cargan menos (por ejemplo, con dolor de rodilla la
//   prensa y los puentes de glúteo en vez de las sentadillas y las zancadas).
// - Con presión alta, problemas del corazón o embarazo se recomienda no hacer series muy
//   pesadas ni aguantar la respiración: repeticiones de 8 en adelante y descansos más
//   largos (guías de la AHA y del ACOG).
// - Si estás empezando, menos ejercicios y más máquinas: son más fáciles de aprender.
// Esto no reemplaza a un médico o fisioterapeuta.
import { exerciseById, type Exercise, type Place, available } from './exercises'

export type Injury = 'rodilla' | 'espalda' | 'hombro' | 'codo' | 'cuello' | 'tobillo'
export type Health = 'presion' | 'diabetes' | 'asma' | 'corazon' | 'embarazo'
export type Level = 'nuevo' | 'algo' | 'experto'

export const INJURIES: { id: Injury; label: string; sub: string; name: string; avoid: string[]; instead: string }[] = [
  { id: 'rodilla', label: 'Rodilla', sub: 'dolor o lesión', name: 'tu rodilla', avoid: ['sentadilla', 'sentadilla-goblet', 'hack', 'zancadas', 'bulgara', 'sentadilla-libre', 'zancadas-libres', 'extensiones'], instead: 'prensa y ejercicios de femoral y glúteo' },
  { id: 'espalda', label: 'Espalda baja', sub: 'lumbar, hernia', name: 'tu espalda baja', avoid: ['peso-muerto', 'remo-barra', 'peso-muerto-rumano', 'rumano-mancuernas', 'sentadilla', 'press-militar', 'elevacion-piernas'], instead: 'máquinas y poleas, con la espalda apoyada' },
  { id: 'hombro', label: 'Hombro', sub: 'manguito, dolor', name: 'tu hombro', avoid: ['press-militar', 'press-banca', 'fondos', 'press-inclinado-barra', 'pike-push-up', 'extension-tras-nuca'], instead: 'press con mancuernas o en máquina' },
  { id: 'codo', label: 'Codo o muñeca', sub: 'tendinitis', name: 'tu codo o muñeca', avoid: ['press-frances', 'curl-barra', 'extension-tras-nuca', 'fondos-banco'], instead: 'polea y mancuernas' },
  { id: 'cuello', label: 'Cuello', sub: 'cervical', name: 'tu cuello', avoid: ['press-militar', 'crunch', 'elevacion-piernas'], instead: 'plancha y press sentado con respaldo' },
  { id: 'tobillo', label: 'Tobillo', sub: 'esguinces', name: 'tu tobillo', avoid: ['zancadas', 'zancadas-libres', 'bulgara'], instead: 'prensa y ejercicios sentado' },
]

export const HEALTH: { id: Health; label: string; note: string }[] = [
  { id: 'presion', label: 'Presión alta', note: 'Presión alta: no aguantes la respiración al hacer fuerza. Te dejé series de 8 o más repeticiones y descansos más largos.' },
  { id: 'diabetes', label: 'Diabetes', note: 'Diabetes: si usas insulina, revisa tu glucosa antes y después de entrenar, y ten algo dulce a mano.' },
  { id: 'asma', label: 'Asma', note: 'Asma: calienta unos 10 minutos y ten tu inhalador cerca.' },
  { id: 'corazon', label: 'Corazón', note: 'Corazón: pide el visto bueno de tu médico antes de empezar. Te dejé series suaves y descansos más largos.' },
  { id: 'embarazo', label: 'Embarazo', note: 'Embarazo: habla con tu médico antes de entrenar o cambiar lo que comes. Bajar de peso no se recomienda en esta etapa.' },
]

export const LEVELS: { id: Level; label: string; sub: string }[] = [
  { id: 'nuevo', label: 'Estoy empezando', sub: 'Nunca he entrenado o hace mucho no lo hago' },
  { id: 'algo', label: 'Algo de experiencia', sub: 'Menos de 2 años entrenando' },
  { id: 'experto', label: 'Tengo experiencia', sub: 'Más de 2 años, conozco los ejercicios' },
]

// Lo que el generador de rutinas necesita saber.
export interface Care {
  exclude: Set<string> // ejercicios que no conviene hacer
  gentle: boolean // series más suaves (presión, corazón, embarazo)
  level: Level
}
export const NO_CARE: Care = { exclude: new Set(), gentle: false, level: 'algo' }

export function careOf(p: { injuries: Injury[]; health: Health[]; level: Level } | undefined): Care {
  if (!p) return NO_CARE
  const exclude = new Set(INJURIES.filter((i) => p.injuries.includes(i.id)).flatMap((i) => i.avoid))
  if (p.health.includes('embarazo')) for (const id of ['crunch', 'crunch-polea', 'elevacion-piernas']) exclude.add(id)
  return { exclude, gentle: p.health.some((h) => h === 'presion' || h === 'corazon' || h === 'embarazo'), level: p.level }
}

// ¿Por qué no conviene este ejercicio? "Cuida tu rodilla" (o nada si está bien).
export function cautionFor(e: Exercise, injuries: Injury[]) {
  const i = INJURIES.find((x) => injuries.includes(x.id) && x.avoid.includes(e.id))
  return i ? `Cuida ${i.name}` : ''
}

// "Por tu rodilla, tu rutina no tiene sentadilla ni zancadas: van prensa, hip thrust y curl femoral."
export function careNotes(injuries: Injury[], place: Place): string[] {
  return INJURIES.filter((i) => injuries.includes(i.id)).map((i) => {
    const names = i.avoid.map((id) => exerciseById.get(id)).filter((e): e is Exercise => !!e && available(e, place)).map((e) => e.name.toLowerCase())
    if (!names.length) return `Por ${i.name}, si un ejercicio te duele, cámbialo por otro del mismo músculo.`
    const shown = names.slice(0, 3)
    const rest = names.length - shown.length
    const list = rest > 0 ? `${shown.join(', ')} ni ${rest === 1 ? 'otro parecido' : `otros ${rest} parecidos`}`
      : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} ni ${shown.at(-1)}` : shown[0]
    return `Por ${i.name}, tu rutina no tiene ${list}${place === 'gimnasio' ? `: van ${i.instead}` : ''}.`
  })
}

export const healthNotes = (health: Health[]) => HEALTH.filter((h) => health.includes(h.id)).map((h) => h.note)
