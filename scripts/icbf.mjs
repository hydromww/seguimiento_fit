// Convierte la transcripción de la Tabla de Composición de Alimentos Colombianos
// (ICBF, 2018) en el archivo que usa la app: src/data/icbf.json.
//
// Entradas (transcritas a mano desde el PDF, una por página):
//   datos/icbf/proximal/pNNN.csv  código|nombre|humedad|kcal|kJ|proteína|lípidos|CHO totales|CHO disponibles|fibra|cenizas
//   datos/icbf/sodio/naNNN.csv    código|sodio (mg)
//   datos/icbf/azucar.csv         código|azúcar (g), estimado con scripts/azucar.mjs
// Los decimales vienen con coma, como en la tabla original. Celda vacía = sin dato.
//
// Uso: node scripts/icbf.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = (d) => readdirSync(d).filter((f) => f.endsWith('.csv')).sort().map((f) => `${d}/${f}`)
const rows = (file) => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => l.split('|'))
const num = (s) => (s === undefined || s.trim() === '' ? null : Number(s.replace(',', '.')))

const sodium = new Map()
for (const file of dir('datos/icbf/sodio')) for (const [code, value] of rows(file)) sodium.set(code, num(value))

// El azúcar es opcional: si el archivo aún no existe, queda sin dato.
const sugar = new Map()
try {
  for (const [code, value] of rows('datos/icbf/azucar.csv')) sugar.set(code, num(value))
} catch { /* sin archivo de azúcar */ }

const foods = []
for (const file of dir('datos/icbf/proximal')) {
  for (const [code, name, , kcal, , protein, fat, choTotal, choAvail, fiber] of rows(file)) {
    const fib = num(fiber) ?? 0
    // Carbohidratos "disponibles" (los que dan energía). Si la página no los trae,
    // se calculan como totales menos fibra.
    const carbs = num(choAvail) ?? Math.max(0, (num(choTotal) ?? 0) - fib)
    // Formato compacto: [código, nombre, kcal, proteína, carbohidratos, grasa, fibra, sodio, azúcar]
    // El azúcar va como null cuando no hay un equivalente para estimarlo.
    foods.push([code, name.trim(), num(kcal) ?? 0, num(protein) ?? 0, +carbs.toFixed(1), num(fat) ?? 0, fib, sodium.get(code) ?? 0, sugar.get(code) ?? null])
  }
}

const missing = foods.filter(([code]) => !sodium.has(code)).map(([code]) => code)
if (missing.length) console.warn('Sin sodio:', missing.join(', '))
writeFileSync('src/data/icbf.json', JSON.stringify(foods))
console.log(`${foods.length} alimentos → src/data/icbf.json`)
