// Cálculos de nutrición que se usan en varias pantallas.
import type { Nutrients } from './db'

export const NUTRIENTS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
  { key: 'fat', label: 'Grasa', unit: 'g' },
  { key: 'fiber', label: 'Fibra', unit: 'g' },
  { key: 'sugar', label: 'Azúcar', unit: 'g' },
  { key: 'sodium', label: 'Sodio', unit: 'mg' },
]

export const emptyNutrients = (): Nutrients => ({
  kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
})

// Convierte los valores por 100 g a una cantidad concreta en gramos.
// Ejemplo: si 100 g de arroz tienen 130 kcal, 150 g tienen 130 × 1,5 = 195 kcal.
export function forGrams(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100
  const result = emptyNutrients()
  for (const { key } of NUTRIENTS) result[key] = per100g[key] * factor
  return result
}

// Redondeo para mostrar: sin decimales en calorías y sodio, uno en lo demás.
export function fmt(key: keyof Nutrients, value: number): string {
  const decimals = key === 'kcal' || key === 'sodium' ? 0 : 1
  return value.toLocaleString('es', { maximumFractionDigits: decimals })
}
