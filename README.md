# Seguimiento Fit

App personal de seguimiento de alimentación y entrenamiento. Es una app web instalable (PWA): funciona en iPhone, Android y Windows, sin internet, y guarda todos los datos en tu propio dispositivo.

**Abrir la app:** https://hydromww.github.io/seguimiento_fit/ (en el iPhone: ábrela en Safari, toca Compartir y luego "Añadir a pantalla de inicio").

## Estado

- [x] Etapa 1: base de alimentos (tus alimentos + búsqueda y escaneo en Open Food Facts)
- [x] Diseño "D4 Océano" con medidor de calorías
- [ ] Etapa 2: metas de calorías y macros
- [ ] Etapa 3: registro diario de comidas
- [ ] Etapa 4: planes de alimentación

## Probarla en tu computador

Necesitas [Node.js](https://nodejs.org) instalado.

```bash
npm install     # descarga las librerías que usa la app
npm run dev     # arranca la app en http://localhost:5173
npm run build   # genera la versión final en la carpeta dist/
```

Para entender cómo está hecha por dentro, lee [COMO-FUNCIONA.md](COMO-FUNCIONA.md).
