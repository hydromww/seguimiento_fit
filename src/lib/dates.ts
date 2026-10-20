// Utilidades de fechas. Los días se guardan como texto "AAAA-MM-DD" en la hora
// local del teléfono, así un registro de las 11 p. m. no se pasa al día siguiente.

export function dayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

// Los 7 días (lunes a domingo) de la semana en la que cae ese día.
export function weekOf(key: string): string[] {
  const d = fromKey(key)
  const monday = addDays(key, -((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// "martes 20 de octubre"
export const longDate = (key: string) =>
  fromKey(key).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
export const weekdayLetter = (key: string) =>
  fromKey(key).toLocaleDateString('es', { weekday: 'narrow' }).toUpperCase()
