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
  App.tsx                  La estructura general: título, pantalla actual y menú inferior.
  index.css                Los estilos (colores, tamaños). Tiene modo claro y oscuro.
  lib/
    db.ts                  La base de datos y la "ficha" de un alimento.
    nutrition.ts           Cálculos: pasar de valores por 100 g a una porción, redondeos.
    openFoodFacts.ts       Cómo pedimos datos a Open Food Facts y los traducimos a nuestra ficha.
  components/
    FoodsScreen.tsx        La pantalla "Alimentos": la lista, el filtro y los botones.
    FoodForm.tsx           El formulario para crear o editar un alimento.
    OffSearch.tsx          La búsqueda por nombre en Open Food Facts.
    BarcodeScanner.tsx     El escáner de códigos de barras con la cámara.
```

## La ficha de un alimento

Está definida en `src/lib/db.ts`. Cada alimento guarda:

- nombre, marca (opcional) y de dónde salió (`propio` u `openfoodfacts`);
- código de barras, si tiene;
- calorías, proteína, carbohidratos, grasa, fibra, azúcar (en gramos) y sodio (en miligramos), **siempre por 100 g**;
- una porción habitual con nombre y peso, por ejemplo "1 huevo = 50 g";
- si es favorito.

Guardar todo por 100 g permite comparar alimentos y calcular cualquier cantidad con una regla de tres: si 100 g de huevo tienen 143 kcal, un huevo de 50 g tiene 143 × 0,5 = 72 kcal. Esa cuenta está en la función `forGrams` de `src/lib/nutrition.ts`.

## Qué pasa al buscar en Open Food Facts

1. Escribes "avena" y la app pide a Open Food Facts los productos que coinciden.
2. Llegan en el formato de ellos. La función `toFood` los traduce a nuestra ficha (por ejemplo, ellos dan el sodio en gramos y nosotros lo usamos en miligramos).
3. Al tocar un resultado se abre el formulario ya relleno, para que revises los datos antes de guardarlo.
4. Una vez guardado, el alimento queda en tu dispositivo y ya no hace falta internet para usarlo.

Si escaneas o buscas un producto que ya guardaste, la app abre tu ficha en lugar de traerlo de nuevo.
