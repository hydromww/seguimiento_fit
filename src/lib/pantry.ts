// La despensa del asistente de planes: alimentos comunes en Colombia, ya cocidos o
// listos para comer, con su código en la tabla del ICBF. Algunos se cuentan por
// unidades (un huevo, una arepa) para que el plan diga "2 huevos" y no "100 g".
export interface PantryItem {
  label: string
  code: string // código ICBF
  unit?: [name: string, grams: number]
}

export const PANTRY: { group: string; items: PantryItem[] }[] = [
  {
    group: 'Proteínas',
    items: [
      { label: 'Huevo', code: 'J003', unit: ['huevo', 50] },
      { label: 'Pechuga de pollo', code: 'F086' },
      { label: 'Carne de res', code: 'F104' },
      { label: 'Atún en agua', code: 'E004' },
      { label: 'Lomo de cerdo', code: 'F020' },
      { label: 'Pescado (mojarra)', code: 'E043' },
      { label: 'Queso campesino', code: 'G017' },
      { label: 'Cuajada', code: 'G016' },
      { label: 'Lentejas', code: 'T025' },
    ],
  },
  {
    group: 'Carbohidratos',
    items: [
      { label: 'Arroz blanco', code: 'A009' },
      { label: 'Arepa', code: 'A005', unit: ['arepa', 80] },
      { label: 'Papa', code: 'B067' },
      { label: 'Plátano maduro', code: 'B088' },
      { label: 'Avena en hojuelas', code: 'A012' },
      { label: 'Pan integral', code: 'A069', unit: ['tajada', 30] },
      { label: 'Pasta', code: 'A073' },
      { label: 'Fríjoles', code: 'T010' },
      { label: 'Yuca', code: 'B106' },
    ],
  },
  {
    group: 'Frutas y verduras',
    items: [
      { label: 'Banano', code: 'C010', unit: ['banano', 120] },
      { label: 'Manzana', code: 'C054', unit: ['manzana', 150] },
      { label: 'Papaya', code: 'C065' },
      { label: 'Mango', code: 'C051' },
      { label: 'Piña', code: 'C072' },
      { label: 'Tomate', code: 'B103' },
      { label: 'Lechuga', code: 'B059' },
      { label: 'Brócoli', code: 'B025' },
      { label: 'Zanahoria', code: 'B110' },
      { label: 'Espinaca', code: 'B044' },
      { label: 'Pepino', code: 'B077' },
    ],
  },
  {
    group: 'Grasas y otros',
    items: [
      { label: 'Aguacate', code: 'C001' },
      { label: 'Aceite de oliva', code: 'D008' },
      { label: 'Maní', code: 'T029' },
      { label: 'Mantequilla de maní', code: 'D016' },
      { label: 'Leche entera', code: 'G012' },
      { label: 'Leche descremada', code: 'G007' },
    ],
  },
]

export const EXCLUSIONS = [
  { id: 'lacteos', label: 'Sin lácteos', test: (n: string, code?: string) => code?.startsWith('G') || /leche|queso|cuajada|yogur|kumis|crema/.test(n) },
  { id: 'cerdo', label: 'Sin cerdo', test: (n: string) => /cerdo|chorizo|tocino|chicharr|jam[oó]n|salchich/.test(n) },
  { id: 'vegetariano', label: 'Vegetariano', test: (n: string, code?: string) => code?.startsWith('E') || code?.startsWith('F') || /pollo|res\b|carne|cerdo|pescado|mojarra|at[uú]n|salm[oó]n|jam[oó]n/.test(n) },
  { id: 'gluten', label: 'Sin gluten', test: (n: string) => /\bpan\b|pasta|trigo|galleta|avena|ponqu/.test(n) },
] as const
export type Exclusion = (typeof EXCLUSIONS)[number]['id']
