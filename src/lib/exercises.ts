// El catálogo de ejercicios: nombre, músculo principal, con qué se hace y si es
// "compuesto" (mueve varias articulaciones y mucho peso, como la sentadilla) o de
// "aislamiento" (un solo músculo, como el curl de bíceps).
export type Muscle = 'pecho' | 'espalda' | 'hombro' | 'biceps' | 'triceps' | 'cuadriceps' | 'femoral' | 'gluteo' | 'pantorrilla' | 'core'
export type Equipment = 'barra' | 'mancuernas' | 'maquina' | 'polea' | 'corporal'
export type Place = 'gimnasio' | 'casa' | 'corporal'

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
  compound: boolean
  step?: number // cuánto subir de peso cuando toca (kg); por defecto 2,5
  bodyweight?: boolean // se cuenta en repeticiones, sin kilos
}

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'hombro', label: 'Hombro' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'femoral', label: 'Femoral' },
  { id: 'gluteo', label: 'Glúteo' },
  { id: 'pantorrilla', label: 'Pantorrilla' },
  { id: 'core', label: 'Abdomen' },
]
export const muscleLabel = (m: Muscle) => MUSCLES.find((x) => x.id === m)!.label

const E = (id: string, name: string, muscle: Muscle, equipment: Equipment, compound: boolean, extra: Partial<Exercise> = {}): Exercise =>
  ({ id, name, muscle, equipment, compound, ...extra })

export const EXERCISES: Exercise[] = [
  // Pecho
  E('press-banca', 'Press de banca', 'pecho', 'barra', true),
  E('press-inclinado-barra', 'Press inclinado con barra', 'pecho', 'barra', true),
  E('press-mancuernas', 'Press con mancuernas', 'pecho', 'mancuernas', true, { step: 2 }),
  E('press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'pecho', 'mancuernas', true, { step: 2 }),
  E('press-pecho-maquina', 'Press de pecho en máquina', 'pecho', 'maquina', true, { step: 5 }),
  E('aperturas-mancuernas', 'Aperturas con mancuernas', 'pecho', 'mancuernas', false, { step: 2 }),
  E('cruce-poleas', 'Cruce en poleas', 'pecho', 'polea', false),
  E('fondos', 'Fondos en paralelas', 'pecho', 'corporal', true, { bodyweight: true }),
  E('flexiones', 'Flexiones de pecho', 'pecho', 'corporal', true, { bodyweight: true }),
  // Espalda (en orden de preferencia: el generador toma el primero que sirva)
  E('jalon-pecho', 'Jalón al pecho', 'espalda', 'polea', true, { step: 5 }),
  E('remo-barra', 'Remo con barra', 'espalda', 'barra', true),
  E('remo-mancuerna', 'Remo con mancuerna', 'espalda', 'mancuernas', true, { step: 2 }),
  E('remo-polea', 'Remo sentado en polea', 'espalda', 'polea', true, { step: 5 }),
  E('dominadas', 'Dominadas', 'espalda', 'corporal', true, { bodyweight: true }),
  E('remo-maquina', 'Remo en máquina', 'espalda', 'maquina', true, { step: 5 }),
  E('peso-muerto', 'Peso muerto', 'espalda', 'barra', true, { step: 5 }),
  E('pullover-polea', 'Pullover en polea', 'espalda', 'polea', false),
  E('remo-invertido', 'Remo invertido', 'espalda', 'corporal', true, { bodyweight: true }),
  // Hombro
  E('press-militar', 'Press militar con barra', 'hombro', 'barra', true),
  E('press-hombro-mancuernas', 'Press de hombro con mancuernas', 'hombro', 'mancuernas', true, { step: 2 }),
  E('press-hombro-maquina', 'Press de hombro en máquina', 'hombro', 'maquina', true, { step: 5 }),
  E('elevaciones-laterales', 'Elevaciones laterales', 'hombro', 'mancuernas', false, { step: 1 }),
  E('laterales-polea', 'Elevaciones laterales en polea', 'hombro', 'polea', false, { step: 1 }),
  E('face-pull', 'Face pull', 'hombro', 'polea', false),
  E('pajaros', 'Pájaros (deltoides posterior)', 'hombro', 'mancuernas', false, { step: 1 }),
  E('pike-push-up', 'Flexiones en pica', 'hombro', 'corporal', true, { bodyweight: true }),
  // Bíceps
  E('curl-barra', 'Curl con barra', 'biceps', 'barra', false),
  E('curl-mancuernas', 'Curl con mancuernas', 'biceps', 'mancuernas', false, { step: 1 }),
  E('curl-martillo', 'Curl martillo', 'biceps', 'mancuernas', false, { step: 1 }),
  E('curl-polea', 'Curl en polea', 'biceps', 'polea', false),
  E('curl-inclinado', 'Curl inclinado con mancuernas', 'biceps', 'mancuernas', false, { step: 1 }),
  // Tríceps
  E('extension-polea', 'Extensión de tríceps en polea', 'triceps', 'polea', false),
  E('press-frances', 'Press francés', 'triceps', 'barra', false),
  E('extension-tras-nuca', 'Extensión tras nuca con mancuerna', 'triceps', 'mancuernas', false, { step: 1 }),
  E('press-cerrado', 'Press de banca agarre cerrado', 'triceps', 'barra', true),
  E('fondos-banco', 'Fondos en banco', 'triceps', 'corporal', false, { bodyweight: true }),
  // Cuádriceps
  E('sentadilla', 'Sentadilla', 'cuadriceps', 'barra', true, { step: 5 }),
  E('sentadilla-goblet', 'Sentadilla goblet', 'cuadriceps', 'mancuernas', true, { step: 2 }),
  E('prensa', 'Prensa de piernas', 'cuadriceps', 'maquina', true, { step: 10 }),
  E('hack', 'Sentadilla hack', 'cuadriceps', 'maquina', true, { step: 5 }),
  E('zancadas', 'Zancadas con mancuernas', 'cuadriceps', 'mancuernas', true, { step: 2 }),
  E('bulgara', 'Sentadilla búlgara', 'cuadriceps', 'mancuernas', true, { step: 2 }),
  E('extensiones', 'Extensiones de cuádriceps', 'cuadriceps', 'maquina', false, { step: 5 }),
  E('sentadilla-libre', 'Sentadilla sin peso', 'cuadriceps', 'corporal', true, { bodyweight: true }),
  E('zancadas-libres', 'Zancadas sin peso', 'cuadriceps', 'corporal', true, { bodyweight: true }),
  // Femoral y glúteo
  E('peso-muerto-rumano', 'Peso muerto rumano', 'femoral', 'barra', true, { step: 5 }),
  E('rumano-mancuernas', 'Peso muerto rumano con mancuernas', 'femoral', 'mancuernas', true, { step: 2 }),
  E('curl-femoral', 'Curl femoral', 'femoral', 'maquina', false, { step: 5 }),
  E('hip-thrust', 'Hip thrust', 'gluteo', 'barra', true, { step: 5 }),
  E('puente-gluteo', 'Puente de glúteo', 'gluteo', 'corporal', false, { bodyweight: true }),
  E('puente-una-pierna', 'Puente a una pierna', 'femoral', 'corporal', false, { bodyweight: true }),
  E('patada-gluteo', 'Patada de glúteo en polea', 'gluteo', 'polea', false),
  E('abductores', 'Abductores en máquina', 'gluteo', 'maquina', false, { step: 5 }),
  // Pantorrilla
  E('pantorrilla-pie', 'Elevación de talones de pie', 'pantorrilla', 'maquina', false, { step: 5 }),
  E('pantorrilla-mancuernas', 'Elevación de talones con mancuernas', 'pantorrilla', 'mancuernas', false, { step: 2 }),
  E('pantorrilla-libre', 'Elevación de talones sin peso', 'pantorrilla', 'corporal', false, { bodyweight: true }),
  // Abdomen
  E('plancha', 'Plancha (segundos)', 'core', 'corporal', false, { bodyweight: true }),
  E('crunch-polea', 'Crunch en polea', 'core', 'polea', false),
  E('elevacion-piernas', 'Elevación de piernas colgado', 'core', 'corporal', false, { bodyweight: true }),
  E('crunch', 'Crunch abdominal', 'core', 'corporal', false, { bodyweight: true }),
]

export const exerciseById = new Map(EXERCISES.map((e) => [e.id, e]))
export const exerciseName = (id: string) => exerciseById.get(id)?.name ?? id

// ¿Se puede hacer en ese lugar?
export function available(e: Exercise, place: Place) {
  if (place === 'gimnasio') return true
  if (place === 'casa') return e.equipment === 'mancuernas' || e.equipment === 'corporal'
  return e.equipment === 'corporal'
}
