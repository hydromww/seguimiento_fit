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
    db.ts                  La base de datos: la "ficha" de un alimento y los registros del diario.
    dates.ts               Fechas: el día de hoy, la semana, "martes 20 de octubre".
    diary.ts               El diario: registrar, corregir, sumar el día y saber qué comes más.
    nutrition.ts           Cálculos: pasar de valores por 100 g a una porción, redondeos.
    openFoodFacts.ts       Cómo pedimos datos a Open Food Facts y los traducimos a nuestra ficha.
    icbf.ts                La búsqueda en la tabla colombiana del ICBF.
    goals.ts               Tus metas: los cálculos, los días de entreno y cómo se guardan.
    weight.ts              Tu peso: la tendencia, el ritmo y la revisión de 3 semanas.
  data/
    icbf.json              Los 773 alimentos del ICBF, generados con scripts/icbf.mjs.
  components/
    TodayScreen.tsx        La pantalla "Hoy": semana, medidor y tus comidas del día.
    AddSheet.tsx           Agregar a una comida: buscar en tus alimentos, el ICBF u Open Food Facts.
    QuantitySheet.tsx      La hoja de abajo para elegir cuántos gramos comiste.
    MealTabs.tsx           Las pestañas Desayuno, Almuerzo, Cena y Snacks.
    FoodsScreen.tsx        La pantalla "Alimentos": medidor, buscador, accesos y la lista.
    CalorieGauge.tsx       El medidor de calorías del día: cuánto llevas y cuánto te queda.
    GoalsScreen.tsx        La pantalla "Metas": el resumen de tus metas y cómo empezar.
    GoalWizard.tsx         El asistente paso a paso ("Guíame paso a paso").
    ManualGoals.tsx        El editor para quien ya sabe sus números.
    WeightSheet.tsx        La hoja para anotar tu peso de un día.
    WeightScreen.tsx       La pantalla "Tu peso": gráfica, ritmo y tus pesadas.
    WeightChart.tsx        La gráfica del peso (puntos, tendencia y tu plan).
    ReviewScreen.tsx       La revisión de 3 semanas y la propuesta de meta nueva.
    MacroBar.tsx           La barra de colores con el reparto de calorías de cada alimento.
    Icons.tsx              Los íconos de la app.
    FoodForm.tsx           El formulario para crear o editar un alimento.
    OffSearch.tsx          La búsqueda por nombre: primero el ICBF, luego Open Food Facts.
    BarcodeScanner.tsx     El escáner de códigos de barras con la cámara.
datos/icbf/               La transcripción de la tabla del ICBF, una página por archivo.
scripts/icbf.mjs          Convierte esa transcripción en src/data/icbf.json.
scripts/azucar.mjs        Estima el azúcar con la tabla del USDA (datos/usda/).
```

## La ficha de un alimento

Está definida en `src/lib/db.ts`. Cada alimento guarda:

- nombre, marca (opcional) y de dónde salió (`propio`, `icbf` u `openfoodfacts`);
- código de barras, si tiene;
- calorías, proteína, carbohidratos, grasa, fibra, azúcar (en gramos) y sodio (en miligramos), **siempre por 100 g**;
- una porción habitual con nombre y peso, por ejemplo "1 huevo = 50 g";
- si es favorito.

Guardar todo por 100 g permite comparar alimentos y calcular cualquier cantidad con una regla de tres: si 100 g de huevo tienen 143 kcal, un huevo de 50 g tiene 143 × 0,5 = 72 kcal. Esa cuenta está en la función `forGrams` de `src/lib/nutrition.ts`.

## El diario (pantalla Hoy)

Cada vez que agregas algo se guarda un **registro**: qué día, en qué comida, qué alimento y cuántos gramos. El registro guarda además una copia de los nutrientes de esa cantidad. Así, si mañana corriges la ficha de un alimento, tus días pasados no cambian.

- Si agregas un alimento del ICBF o de Open Food Facts, se guarda solo en tus alimentos. Por eso la próxima vez aparece de primero en "Frecuentes y favoritos".
- Los frecuentes se calculan contando cuántas veces registraste cada alimento en los últimos 60 días.
- El medidor suma todos los registros del día y te dice cuánto te queda frente a la meta de ese día.

## Las metas (pantalla Metas)

Hay dos caminos: **Guíame paso a paso** (6 preguntas) y **Ya sé mis números** (escribes calorías y macros en gramos, g por kilo o porcentaje). Todo el cálculo está en `src/lib/goals.ts`.

Cómo calcula el asistente, en orden:

1. **Lo que gasta tu cuerpo en reposo.** Fórmula Mifflin-St Jeor (1990), la más precisa para adultos según la Academia de Nutrición y Dietética de EE. UU. Si das tu % de grasa usa Katch-McArdle, que parte de tu masa magra.
2. **Tu día.** Se multiplica por un factor según tu trabajo: 1,3 sentado, 1,45 de pie, 1,65 físico.
3. **Tus pasos.** Los que pasan de 4.000 (eso ya lo cubre el factor anterior) suman unas 0,5 kcal por kilo de peso cada 1.000 pasos.
4. **Tus entrenos.** Marcas qué días haces pesas y qué días cardio (un día puede tener los dos), y cuántos minutos dura cada sesión. Valores MET del Compendio de Actividades Físicas (Ainsworth, 2011): pesas 5 y cardio moderado 7. Se resta 1 porque el reposo ya está contado, y se reparte en los 7 días.
5. **Tu objetivo.** 1 kg de grasa son unas 7.700 kcal. Para perder, nunca más del 1 % de tu peso por semana. Recomposición: −150 o −300 kcal. Ganar músculo: +200 a +450 kcal. Nunca baja de 1.500 kcal (hombres) o 1.200 (mujeres).
6. **Proteína.** Según el objetivo: 2,0 g/kg para perder grasa o recomposición, 1,8 para ganar, 1,6 para mantener o rendimiento, 1,2 para comer más sano (ISSN 2017; Morton 2018; Helms 2014). Si tu IMC pasa de 27, se usa un peso de referencia (tu peso meta o el de IMC 25) para no inflarla.
7. **Grasa.** 27 % de las calorías (22 % alto en carbos, 40 % bajo en carbos), y nunca menos de 0,6 g por kilo.
8. **Carbohidratos.** Lo que queda. En rendimiento se garantizan al menos 5 g/kg (ACSM), quitándolos de la grasa.
9. **Otras metas.** Fibra 14 g por cada 1.000 kcal (Institute of Medicine). Azúcar máximo 10 % de las calorías y sodio máximo 2.000 mg (OMS).

**Días de entreno.** Si eliges "Entreno y descanso", cada día recibe su propia meta: los días de pesas suman lo que gasta una sesión de pesas, los de cardio lo que gasta una de cardio (y los dos si haces ambos), y los de descanso bajan, de modo que el promedio de la semana es el mismo. Hoy muestra "Día de pesas", "Día de cardio" o "Día de descanso". La diferencia va toda en carbohidratos. "Por día de la semana" hace lo mismo con 300 kcal.

Ejemplo comprobado: hombre, 32 años, 178 cm, 82 kg, oficina, 4 días de pesas de 60 minutos, 8.000 pasos y perder 0,5 kg por semana → gasta unas 2.660 kcal y su meta es 2.110 kcal (164 g de proteína, 221 g de carbos, 63 g de grasa): 2.250 los días de entreno y 1.920 los demás.

Son estimaciones: cada cuerpo es distinto. Por eso la app aprende de tu peso real (abajo).

## Tu peso y la revisión de 3 semanas

Anotas tu peso desde Hoy ("¿Ya te pesaste?") o desde la tarjeta "Tu peso" en Metas. Se guarda una pesada por día. Todo está en `src/lib/weight.ts`.

- **Tendencia.** El peso de un día sube y baja hasta 1 kg por agua, sal y comida. La tendencia es una media móvil exponencial: cada pesada nueva mueve la tendencia un 20 % hacia ella (la idea de The Hacker's Diet). Arranca con el promedio de las 3 primeras pesadas.
- **Ritmo.** Los kg por semana salen de la recta que mejor pasa por tus pesadas de las últimas 3 semanas (regresión lineal), así un día raro casi no lo mueve.
- **Cuándo hay revisión.** 21 días después de poner o revisar tu meta, con al menos 8 pesadas que cubran 14 días o más.
- **Con tus comidas** (14 días o más con al menos 800 kcal anotadas): tu gasto real = lo que comiste en promedio + lo que bajaste en esas semanas pasado a calorías (1 kg ≈ 7.700 kcal). A ese gasto se le aplica el mismo déficit o superávit de tu plan.
- **Sin suficientes comidas anotadas:** se compara tu ritmo con el del plan y se corrige la mitad de la diferencia, por prudencia.
- **Límites.** La meta cambia máximo 200 kcal por revisión y nunca baja de 1.500 kcal (hombres) o 1.200 (mujeres).
- **Al aplicar,** se guarda tu peso actual (la tendencia) y una corrección del gasto (`tdeeOffset`). Si luego recalculas con el asistente, esa corrección se mantiene y aparece como "Según tu peso real". Si tus metas son manuales, la app te muestra lo que vio pero no las cambia sola.

Ejemplo: comiste 2.160 kcal en promedio y tu tendencia bajó 0,8 kg en 21 días → 0,8 × 7.700 ÷ 21 ≈ 290 kcal por día → gastas unas 2.450 kcal, no las 2.670 que calculó la fórmula. Para bajar 0,5 kg por semana lo ideal serían unas 1.900 kcal; como el cambio máximo es 200, la meta pasa de 2.120 a 1.920 y la siguiente revisión sigue afinando.

## La tabla colombiana del ICBF

El ICBF publica la *Tabla de Composición de Alimentos Colombianos*: 773 alimentos analizados en laboratorio, desde arepa y bocachico hasta lulo y chigüiro. Viene dentro de la app, así que se busca al instante y sin internet. Al buscar "platano maduro" (sin tilde también vale) aparecen primero los resultados del ICBF y debajo los productos de Open Food Facts.

Dos detalles de esos datos:

- Los carbohidratos son los "disponibles", los que dan energía (sin la fibra), igual que en las etiquetas de productos colombianos.
- La tabla no trae azúcar por alimento, así que lo estimamos. Cada alimento colombiano se emparejó con su equivalente en la tabla pública del USDA (Estados Unidos) y se aplicó la misma proporción de azúcar sobre los carbohidratos (detalles en `scripts/azucar.mjs`). Para unos pocos alimentos nativos usamos el azúcar que midió el propio ICBF. Los que no tienen equivalente (lulo, uchuva, tomate de árbol, varios alimentos amazónicos) llegan en 0 y puedes completarlo antes de guardar.

## Qué pasa al buscar en Open Food Facts

1. Escribes "avena" y la app pide a Open Food Facts los productos que coinciden.
2. Llegan en el formato de ellos. La función `toFood` los traduce a nuestra ficha (por ejemplo, ellos dan el sodio en gramos y nosotros lo usamos en miligramos).
3. Al tocar un resultado se abre el formulario ya relleno, para que revises los datos antes de guardarlo.
4. Una vez guardado, el alimento queda en tu dispositivo y ya no hace falta internet para usarlo.

Si escaneas o buscas un producto que ya guardaste, la app abre tu ficha en lugar de traerlo de nuevo.

## El diseño

Los colores están definidos una sola vez, como variables al principio de `src/index.css` (por ejemplo `--accent` es el azul verdoso principal). Si quieres probar otro color, basta con cambiar esa línea y se actualiza en toda la app. La fuente es Outfit, y viene incluida en la app para que funcione sin internet.

La barra de cada alimento reparte sus calorías: cada gramo de proteína y de carbohidrato aporta 4 kcal y cada gramo de grasa 9 kcal. Por eso el huevo, con poca grasa en gramos, muestra mucho rosa: la grasa pesa más en calorías.
