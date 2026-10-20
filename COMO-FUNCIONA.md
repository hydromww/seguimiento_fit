# Cómo funciona la app por dentro

Esta guía explica el código sin dar por hecho que sabes programar.

## Las piezas

- **React** es la librería con la que dibujamos la pantalla. Cada parte de la pantalla es un *componente*: una función que recibe datos y devuelve lo que se ve. Cuando los datos cambian, React vuelve a dibujar solo esa parte.
- **TypeScript** es JavaScript (el lenguaje de la web) con *tipos*: le decimos de antemano qué forma tienen los datos (por ejemplo, que las calorías son un número). Así el editor avisa de errores antes de abrir la app.
- **Vite** es la herramienta que arranca la app mientras la desarrollamos y la empaqueta al final.
- **IndexedDB + Dexie**: IndexedDB es una base de datos que trae cada navegador. Dexie la hace fácil de usar. Ahí se guardan tus alimentos, en tu dispositivo.
- **PWA** (Progressive Web App): es lo que permite instalar la web como una app en el iPhone ("Compartir > Añadir a pantalla de inicio") y usarla sin internet.

## Los archivos

```
src/
  main.tsx                 Punto de entrada: monta la app en la página.
  App.tsx                  La estructura general: saludo, título, pantalla actual y menú flotante.
  index.css                Los estilos del diseño "D4 Océano" (colores, tamaños). Tiene modo claro y oscuro.
  lib/
    perfil.ts              Tu nombre, para el saludo.
    db.ts                  La base de datos y la "ficha" de un alimento.
    nutrition.ts           Cálculos: pasar de valores por 100 g a una porción, redondeos.
    openFoodFacts.ts       Cómo pedimos datos a Open Food Facts y los traducimos a nuestra ficha.
    icbf.ts                La búsqueda en la tabla colombiana del ICBF.
  data/
    icbf.json              Los 773 alimentos del ICBF, generados con scripts/icbf.mjs.
  components/
    FoodsScreen.tsx        La pantalla "Alimentos": medidor, buscador, accesos y la lista.
    CalorieGauge.tsx       El medidor de calorías del día (se llenará con las etapas 2 y 3).
    MacroBar.tsx           La barra de colores con el reparto de calorías de cada alimento.
    Icons.tsx              Los íconos de la app.
    FoodForm.tsx           El formulario para crear o editar un alimento.
    OffSearch.tsx          La búsqueda por nombre: primero el ICBF, luego Open Food Facts.
    BarcodeScanner.tsx     El escáner de códigos de barras con la cámara.
datos/icbf/               La transcripción de la tabla del ICBF, una página por archivo.
scripts/icbf.mjs          Convierte esa transcripción en src/data/icbf.json.
```

## La ficha de un alimento

Está definida en `src/lib/db.ts`. Cada alimento guarda:

- nombre, marca (opcional) y de dónde salió (`propio`, `icbf` u `openfoodfacts`);
- código de barras, si tiene;
- calorías, proteína, carbohidratos, grasa, fibra, azúcar (en gramos) y sodio (en miligramos), **siempre por 100 g**;
- una porción habitual con nombre y peso, por ejemplo "1 huevo = 50 g";
- si es favorito.

Guardar todo por 100 g permite comparar alimentos y calcular cualquier cantidad con una regla de tres: si 100 g de huevo tienen 143 kcal, un huevo de 50 g tiene 143 × 0,5 = 72 kcal. Esa cuenta está en la función `forGrams` de `src/lib/nutrition.ts`.

## La tabla colombiana del ICBF

El ICBF publica la *Tabla de Composición de Alimentos Colombianos*: 773 alimentos analizados en laboratorio, desde arepa y bocachico hasta lulo y chigüiro. Viene dentro de la app, así que se busca al instante y sin internet. Al buscar "platano maduro" (sin tilde también vale) aparecen primero los resultados del ICBF y debajo los productos de Open Food Facts.

Dos detalles de esos datos:

- Los carbohidratos son los "disponibles", los que dan energía (sin la fibra), igual que en las etiquetas de productos colombianos.
- La tabla no trae azúcar por alimento, así que llega en 0. Si lo sabes, puedes completarlo antes de guardar.

## Qué pasa al buscar en Open Food Facts

1. Escribes "avena" y la app pide a Open Food Facts los productos que coinciden.
2. Llegan en el formato de ellos. La función `toFood` los traduce a nuestra ficha (por ejemplo, ellos dan el sodio en gramos y nosotros lo usamos en miligramos).
3. Al tocar un resultado se abre el formulario ya relleno, para que revises los datos antes de guardarlo.
4. Una vez guardado, el alimento queda en tu dispositivo y ya no hace falta internet para usarlo.

Si escaneas o buscas un producto que ya guardaste, la app abre tu ficha en lugar de traerlo de nuevo.

## El diseño

Los colores están definidos una sola vez, como variables al principio de `src/index.css` (por ejemplo `--accent` es el azul verdoso principal). Si quieres probar otro color, basta con cambiar esa línea y se actualiza en toda la app. La fuente es Outfit, y viene incluida en la app para que funcione sin internet.

La barra de cada alimento reparte sus calorías: cada gramo de proteína y de carbohidrato aporta 4 kcal y cada gramo de grasa 9 kcal. Por eso el huevo, con poca grasa en gramos, muestra mucho rosa: la grasa pesa más en calorías.
