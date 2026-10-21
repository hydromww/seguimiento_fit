# Seguimiento Fit

App personal de seguimiento de alimentación y entrenamiento. Es una app web instalable (PWA): funciona en iPhone, Android y Windows, sin internet, y guarda todos los datos en tu propio dispositivo.

**Abrir la app:** https://hydromww.github.io/seguimiento_fit/ (en el iPhone: ábrela en Safari, toca Compartir y luego "Añadir a pantalla de inicio").

## Estado

- [x] Etapa 1: base de alimentos (tus alimentos + búsqueda y escaneo en Open Food Facts)
- [x] Tabla de Composición de Alimentos Colombianos del ICBF (773 alimentos, funciona sin internet)
- [x] Diseño "D4 Océano" con medidor de calorías
- [x] Etapa 2: metas de calorías y macros (asistente guiado o tus propios números), con registro de peso y revisión cada 3 semanas
- [x] Etapa 3: registro diario de comidas (pantalla Hoy)
- [x] Etapa 4: planes de alimentación (la app los arma con tu despensa y tu meta) y menú de la semana que se arma solo
- [ ] Más adelante: introducción al abrir la app por primera vez (tu nombre, tus datos y condiciones físicas que afecten el entrenamiento) para que todo se cargue solo
- [ ] Más adelante: pasos desde el iPhone (Atajos de Apple Salud)

## Probarla en tu computador

Necesitas [Node.js](https://nodejs.org) instalado.

```bash
npm install     # descarga las librerías que usa la app
npm run dev     # arranca la app en http://localhost:5173
npm run build   # genera la versión final en la carpeta dist/
```

Para entender cómo está hecha por dentro, lee [COMO-FUNCIONA.md](COMO-FUNCIONA.md).

## Fuente de datos colombiana

Los alimentos colombianos vienen de la *Tabla de Composición de Alimentos Colombianos* del ICBF (2018), https://www.icbf.gov.co/system/files/tcac_web.pdf. El PDF es un escaneo que no permite copiar texto, así que se transcribió página por página a `datos/icbf/` y se revisó cada fila con chequeos automáticos (humedad + proteína + grasa + carbohidratos + cenizas ≈ 100 g, kJ ≈ 4,18 × kcal). Las pocas filas que no cuadran se compararon con la tabla y quedaron tal como las imprime el ICBF. El azúcar, que la tabla del ICBF no trae, se estima emparejando cada alimento con su equivalente en la tabla SR Legacy del USDA (dominio público, `datos/usda/`). Para regenerar los datos después de corregir algo: `node scripts/icbf.mjs && node scripts/azucar.mjs && node scripts/icbf.mjs`.
