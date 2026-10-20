// Estima el azúcar de cada alimento del ICBF, que la tabla colombiana no trae.
//
// Cada alimento se emparejó a mano con su equivalente en la tabla SR Legacy del
// USDA (dominio público): datos/icbf/emparejamientos.csv. Como los dos alimentos
// no tienen exactamente la misma humedad, no copiamos el azúcar tal cual: usamos
// la proporción azúcar / carbohidratos del USDA y la aplicamos a los carbohidratos
// del ICBF. Ej.: banano USDA 12,2 g de azúcar en 22,8 g de carbohidratos (54 %);
// el banano del ICBF tiene 22,2 g de carbohidratos → 12,0 g de azúcar.
//
// El ICBF sí midió el azúcar de unos pocos alimentos (anexo de carbohidratos,
// págs. 122–124: datos/icbf/azucar_icbf.csv), pero varias cifras no pueden ser
// por 100 g (el banano tendría 64 g). Por eso solo lo usamos cuando el
// emparejamiento con el USDA es flojo o no existe, y si la cifra es posible (no
// mayor que los carbohidratos disponibles del alimento).
//
// Escribe datos/icbf/azucar.csv (código|azúcar g). Uso: node scripts/azucar.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const lines = (f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => l.split('|'))
const usda = new Map(lines('datos/usda/sr_legacy.csv').slice(1).map((r) => [r[0], { carb: +r[6], sugar: r[8] === '' ? null : +r[8] }]))
const icbf = new Map(JSON.parse(readFileSync('src/data/icbf.json', 'utf8')).map((r) => [r[0], r]))

const measured = new Map(lines('datos/icbf/azucar_icbf.csv').map(([c, v]) => [c, +v.replace(',', '.')]))

const out = []
const counts = {}
for (const [code, fdc, confianza] of lines('datos/icbf/emparejamientos.csv')) {
  const food = icbf.get(code)
  if (!food) throw new Error(`Código desconocido: ${code}`)
  const own = measured.get(code)
  if ((confianza === 'baja' || confianza === 'ninguna') && own !== undefined && own <= food[4]) {
    counts.icbf = (counts.icbf ?? 0) + 1
    out.push(`${code}|${own.toFixed(1).replace('.', ',')}`)
    continue
  }
  counts[confianza] = (counts[confianza] ?? 0) + 1
  if (fdc === 'NINGUNO') continue
  let sugar = 0
  if (fdc !== 'CERO') {
    const u = usda.get(fdc)
    if (!u || u.sugar === null) throw new Error(`${code}: el USDA ${fdc} no tiene azúcar`)
    const [, , , , carbs, , fiber] = food
    const ratio = u.carb > 0 ? Math.min(1, u.sugar / u.carb) : 0
    // Nunca más azúcar que los carbohidratos disponibles del propio alimento.
    sugar = Math.min(carbs, ratio * (carbs + fiber))
  }
  out.push(`${code}|${sugar.toFixed(1).replace('.', ',')}`)
}
writeFileSync('datos/icbf/azucar.csv', out.join('\n') + '\n')
console.log(`${out.length} alimentos con azúcar estimado`, counts)
