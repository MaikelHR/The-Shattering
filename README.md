# Tierras Intermedias — crónica de un orden roto

Un **scrollytelling** de fantasía: la historia se cuenta con el scroll mientras un
mundo 3D generado en tiempo real se recorre detrás del texto. No hay video ni
imágenes pre-renderizadas — la cámara se mueve de verdad por la escena.

Cuenta la caída de la Orden Áurea de Elden Ring en nueve capítulos: el Árbol
entero, la Fractura del Anillo, lo que quedó de los Semidioses, Caelid podrida,
las raíces encendidas bajo la capital, la ciudad que lleva mil años cayéndose,
el otro árbol que no llegó a florecer, la llama que hay que prender, y el Sinluz
que llega después.

**Stack:** React 19 · TypeScript · Vite · Three.js (React Three Fiber) · GSAP
(ScrollTrigger, ScrollSmoother, SplitText, DrawSVG, ScrambleText, CustomEase)

Cero backend, cero API keys, cero costo. Todo estático.

> Proyecto de fan, sin fines comerciales. Elden Ring es de FromSoftware y Bandai
> Namco. No usa ni un asset del juego: el Árbol, el Anillo, el terreno y todo lo
> que crece en él se generan con código. Las únicas descargas son dos texturas de
> roca de Poly Haven, de dominio público. (La carpeta se sigue llamando `aureth`,
> de la primera versión.)

## Correr

```bash
npm install
npm run dev
```

Abrí la URL que imprime Vite (normalmente `http://localhost:5173`).

## Build y deploy

```bash
npm run build      # revisa tipos y empaqueta a /dist
npm run preview    # sirve el build de producción
```

`dist/` es estático: subilo gratis a Vercel, Netlify o GitHub Pages (para Pages,
descomentá `base` en `vite.config.ts`).

## La idea clave: cómo hablan GSAP y Three.js

Este es el problema real del proyecto, y vale entenderlo bien.

GSAP controla el scroll. El mundo 3D tiene que reaccionar. ¿Cómo se comunican?

**Lo que NO hay que hacer:** que ScrollTrigger llame a `setState` en cada
actualización. El scroll dispara decenas de veces por segundo y cada cambio de
estado re-renderizaría el árbol de React entero. Se traba.

**Lo que hace este proyecto:** un objeto mutable compartido (`src/scrollState.ts`).

```
scroll del usuario
      ↓
ScrollTrigger (App.tsx)  ── escribe ──▶  scrollState { position, progress, ... }
                                                ↓ lee
                                         useFrame (mundo 3D, 60fps)
                                                ↓
                                    cámara, Árbol, Anillo, raíces
```

React nunca se entera de esos cambios, así que no re-renderiza nada. El estado de
React se usa solo para lo que cambia poco: el capítulo activo del riel lateral.

### El dato que importa no es el progreso, es el capítulo

Lo intuitivo sería mapear el progreso total (0 a 1) a los encuadres. No funciona:
el hero y el cierre también ocupan scroll, así que la cámara siempre va corrida y
nunca llega al encuadre del capítulo que estás leyendo.

Por eso `scrollState.position` no sale de una regla de tres sino de la posición
real de cada sección: App mide a qué altura queda centrada cada una y
`writeScroll()` interpola entre esas anclas. Cuando el capítulo IV está en el
medio de la pantalla, la cámara está exactamente en el encuadre del IV.

Y como todo el mundo 3D lee ese mismo número, los umbrales se leen como lo que
son: el Anillo se parte *en el capítulo II*, el este se pudre *llegando al IV*,
el Árbol arde *en el VIII*. Están todos juntos en `world/mood.ts`, porque son
números de estación y una estación nueva en el medio los corre todos.

## Estructura

```
src/
├── App.tsx              # ScrollTrigger maestro + layout de la página
├── story.ts             # TODO el contenido: texto y recorrido de cámara
├── scrollState.ts       # el puente GSAP ⇄ 3D + utilidades (lerp, damp)
├── index.css            # paleta, tipografía, capas
├── components/
│   ├── Chapter.tsx       # sección: título por líneas, entrada direccional, nombres
│   ├── ChapterRail.tsx   # riel de capítulos (elemento de firma)
│   ├── Preloader.tsx     # la runa que se dibuja y el destello que abre
│   ├── Fracture.tsx      # el pin, la grieta y el golpe del capítulo II
│   ├── Atlas.tsx         # el mapa del final, dibujándose con el scroll
│   └── Ambience.tsx      # el sonido, sintetizado y apagado por defecto
└── world/
    ├── World.tsx         # canvas fijo, luces, niebla, calidad
    ├── mood.ts           # QUÉ le pasa al mundo y CUÁNDO, en un solo sitio
    ├── Atmosphere.tsx    # niebla, luz de relleno y color de los rayos
    ├── Sky.tsx           # el domo de cielo, con el halo del Árbol
    ├── Post.tsx          # la cadena de postprocesado
    ├── quality.ts        # los tres niveles y el ajuste automático
    ├── Terrain.tsx       # el suelo, con roca y hierba triplanar
    ├── Grass.tsx         # el pasto instanciado, con viento en el shader
    ├── Leaves.tsx        # lo que flota en el aire, envolviendo a la cámara
    ├── Rocks.tsx         # las pedreras
    ├── Erdtree.tsx       # el Árbol Áureo: ramas, hojas, luz y sombra
    ├── Haligtree.tsx     # el Árbol Sagrado, del mismo generador
    ├── Ruins.tsx         # lo que queda de la capital, cerca
    ├── Capital.tsx       # y la capital en pie, al fondo
    ├── Azula.tsx         # la ciudad que lleva mil años cayéndose
    ├── BrokenRing.tsx    # el Anillo, que la Fractura parte en tres
    ├── Roots.tsx         # las raíces encendidas, cruzando el barranco
    ├── CameraRig.tsx     # la cámara interpolada por el scroll
    ├── FreeFlight.tsx    # y la cámara suelta, cuando la crónica termina
    ├── erdtree/branches.ts    # los árboles, generados por recursión
    ├── ruins/
    │   ├── pieces.ts          # la cantería: columna, sillar, dintel
    │   ├── Batch.tsx          # una tanda de piezas, en una llamada de dibujo
    │   └── layout.ts          # dónde estuvo cada edificio
    └── terrain/
        ├── noise.ts           # ruido de gradiente y sus octavas
        └── heightfield.ts     # el relieve y la consulta de altura
```

**Para reescribir la historia o cambiar el recorrido, editá solo `src/story.ts`.**
(Y si movés estaciones, `world/mood.ts`, que las cuenta por número.)

El recorrido está hecho de **estaciones**: puntos donde la cámara se detiene, con
el viaje interpolado entre una y la siguiente. Y una estación no tiene por qué
llevar texto. Las que no lo llevan son **respiros**: el lector sigue bajando, el
mundo se mueve y no hay nada que leer. Hay nueve de cada.

Sirven para dos cosas a la vez. Dejan respirar la lectura, y le dan a la cámara
puntos intermedios por donde pasar: con capítulos sueltos, el viaje entre uno y
otro es una recta larga que atraviesa el mundo sin que nadie la conduzca. Añadir
un respiro es añadir un nodo a esa curva.

### El orden de los capítulos también lo decide la cámara

Esto no es obvio y vale la pena. La historia empieza y termina mirando al Árbol,
al norte. Cualquier capítulo que mire a otro lado hay que pagarlo dos veces, a la
ida y a la vuelta, y dos vueltas de ciento ochenta grados se sienten como un
latigazo por mucho que se repartan.

Ordenados por pura cronología, el recorrido zigzagueaba: este, noroeste, este,
suroeste. Reordenados —Caelid al este, las raíces abajo, Farum Azula al sur, el
Árbol Sagrado al suroeste— la cámara da **una sola vuelta entera** y vuelve al
norte por el otro lado. Trescientos sesenta grados repartidos en dieciocho
estaciones son sesenta por tramo; el zigzag pedía ciento ochenta dos veces.

Y el orden nuevo también cuenta mejor: el este arrasado, la luz que sigue abajo,
la ciudad que recuerda que hubo otras órdenes, el intento que se congeló, y solo
entonces la decisión de quemarlo todo.

## Detalles que vale la pena mirar en el código

- `useGSAP()` en vez de `useEffect`: limpia las animaciones al desmontar. Sin eso,
  ScrollTrigger acumula instancias muertas en cada recarga en caliente.
- El `scope` de `useGSAP` limita los selectores a cada componente. **Pero el scope
  no alcanza a SplitText**, que resuelve los strings con su propio
  `querySelectorAll` sobre el documento entero: con un selector, cada capítulo
  terminaba partiendo los cinco títulos de la página. Por eso `Chapter.tsx` le pasa
  el elemento por ref.
- Y hay una segunda puerta al mismo problema: con `autoSplit`, el `onSplit` de
  SplitText vuelve a correr cuando cambia el ancho o cargan las fuentes, y esas
  pasadas ocurren **fuera** del contexto de `useGSAP`. Ahí un selector deja de
  estar limitado y alcanza a las dieciocho secciones. Por eso el capítulo
  resuelve todo a elementos antes de construir la timeline.
- `CustomEase` en `CameraRig.tsx` **no anima nada**: `create()` devuelve la
  función de la curva y se la llama a mano dentro del bucle de render. Es GSAP
  prestando la matemática, no conduciendo la escena.
- El mapa del final está en las coordenadas del mundo 3D, pasadas por una sola
  proyección: mirar la escena desde arriba. Los nueve puntos se encienden
  **cuando el trazo los alcanza** —con la longitud acumulada de la ruta, no con
  un `stagger`—, porque los tramos miden cosas muy distintas.
- En el vuelo libre, el techo del ángulo polar se recalcula en cada frame: es el
  ángulo al que la cámara toca el suelo, y depende de lo lejos que esté. Un
  valor fijo la deja flotando cuando está cerca o bajo tierra cuando está lejos.
- `damp()` en vez de `lerp()` crudo: hace el suavizado independiente del framerate.
  La única vez que la cámara no suaviza es el primer frame, donde se planta directo
  en su sitio para que una recarga a mitad de historia no empiece con un viaje.
- El riel escucha `onEnter`/`onEnterBack` y no `onToggle`: cuando alguien arrastra
  la barra de scroll o pulsa Fin, ScrollTrigger salta por encima de secciones que
  nunca llegan a estar activas.
- El canvas escucha los eventos de puntero en `document.body` (`eventSource`), no en
  sí mismo. El texto está encima y lo tapa; sin eso, la deriva de la cámara se
  congelaba apenas el mouse pasaba sobre un capítulo.
- **El encuadre se adapta a la forma de la ventana.** El fov vertical es fijo, así
  que una pantalla vertical ve muchísimo menos a lo ancho: el corrimiento que en un
  monitor deja al sujeto en el lado libre, en un teléfono lo saca de cuadro.
  CameraRig lo devuelve al centro, sube la mirada y toma distancia, en proporción a
  lo angosta que sea la ventana.
- **El tone mapping va al final de la cadena de efectos, no en el renderer.** Con
  `EffectComposer` la escena se renderiza en HDR y los valores por encima de 1
  sobreviven hasta el volcado final: sin ese paso no se comprimen, se recortan, y
  el cielo entero se va a blanco en cuanto el bloom lo toca.
- **La sombra sale del Árbol, no del sol**, que es de donde viene la luz que se ve.
  Un foco desde la copa cuesta un pase de sombra; la luz puntual costaría seis, una
  por cara del cubo.
- **La escala del Árbol no sale de agrandarlo.** Es lo que más costó entender. Un
  objeto enorme y cercano se lee como un objeto normal: lo que comunica el tamaño
  es la distancia percibida, y esa la dan tres cosas juntas. Que esté lejos de
  verdad (el Árbol vive a ciento ochenta unidades, en la cordillera del norte),
  que haya planos intermedios entre el ojo y él, y que la bruma lo lave como lava
  todo lo lejano. De los tres, el que más costó ver es el segundo: durante mucho
  tiempo había ruinas a cincuenta unidades y montañas a ciento cincuenta, y en
  medio nada. La capital ocupa ese hueco, y por eso está puesta — no por decorar.
  Con ella, unas columnas de seis unidades en primer plano dicen sin decir nada
  que el Árbol mide ciento veinte.
- **Lo que flota en el aire envuelve a la cámara, no la sigue.** Si el campo de
  hojas siguiera a la cámara sin más, viajarían con ella y no habría paralaje:
  se leerían como suciedad en el objetivo. Cada hoja se envuelve alrededor de la
  cámara con un `mod` en el shader, así que cuando una se sale por un lado de la
  caja entra por el otro. El campo resulta infinito costando novecientas hojas, y
  cada una se queda donde está mientras la cámara pasa.
- **El sonido está sintetizado: no hay ni un archivo.** Viento de ruido rosa
  filtrado, el zumbido de las raíces en dos senos desafinados entre sí, y un
  barrido grave en la Fractura. Es la misma decisión que el resto del proyecto y
  además pesa cero. Arranca apagado, siempre.
- **El mundo cambia de color con la niebla y las luces, no con un filtro.** Cuando
  el este se pudre y cuando el Árbol arde, lo tentador es una vuelta de tono en el
  postprocesado. Se ve mal, y por una razón concreta: un filtro tiñe por igual lo
  cercano y lo lejano, y lo que hace creíble un cambio de luz es justamente que no.
  Acá el rojo entra por donde entraría de verdad —la distancia se llena de él, la
  luz rebotada lo trae, los haces que bajan del Árbol lo llevan— y lo cercano llega
  el último.
- **Las crestas de la cordillera se muestrean a distinta frecuencia en cada eje.**
  Con la misma en las dos, el ruido da un campo de conos iguales y el horizonte se
  lee como el mismo triángulo repetido. Estirado, salen líneas de cumbres, que es
  la forma que tiene una cordillera de verdad porque la hace un plegamiento y un
  plegamiento tiene dirección. Y la amplitud de las crestas lleva su propio ruido,
  mucho más lento, para que no todas las cumbres salgan a la misma altura.
- **Los dos árboles y las raíces salen del mismo generador.** El Áureo se abre en
  abanico y es de oro; el Sagrado es pálido y no llega a la mitad de alto; y las
  raíces del barranco son el mismo código con siete de sus ocho generaciones en
  régimen de tronco, así que en vez de copa sale un cable largo que cruza la
  grieta. Lo único que cambia son los parámetros.
- **El terreno es un abanico de anillos, no una cuadrícula.** Los radios crecen al
  cuadrado, así que casi todos los vértices caen donde está la cámara y el
  horizonte se lleva cuatro. Cubrir 290 unidades con una cuadrícula uniforme y el
  mismo detalle cerca costaría un millón de vértices; así son cuarenta y seis mil.
- **Las cámaras viven dentro del terreno.** En cuanto una se sale del borde, se ve
  el límite del mundo y el suelo se lee como una isla de juguete.
- `prefers-reduced-motion` se respeta con una regla simple: **el mundo solo se mueve
  cuando el usuario scrollea**. Se apaga el movimiento autónomo (el Árbol, el
  Anillo, el viento en la hierba, el latido de las raíces, el giro de la ciudad,
  el titileo de las estrellas, el grano de película, la inercia de la cámara, el
  parallax y los revelados de texto) y se deja lo que responde al scroll. Comprobado comparando
  dos capturas separadas en el tiempo: salen idénticas byte a byte, salvo por el
  ruido del denoiser de la oclusión ambiental, que cambia de un frame a otro por
  debajo del umbral de lo perceptible.

## Qué sigue

- **[PLAN.md](./PLAN.md)** — lo que falta, en orden, y lo que se decidió no hacer.
- **[BITACORA.md](./BITACORA.md)** — lo que pasó y lo que costó averiguarlo: las
  decisiones de fondo y las trampas en las que ya caímos.
