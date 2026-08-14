# Tierras Intermedias — crónica de un orden roto

Un **scrollytelling** de fantasía: la historia se cuenta con el scroll mientras un
mundo 3D generado en tiempo real se recorre detrás del texto. No hay video ni
imágenes pre-renderizadas — la cámara se mueve de verdad por la escena.

Cuenta la caída de la Orden Áurea de Elden Ring en cinco capítulos: el Árbol
entero, la Fractura del Anillo, lo que quedó de los Semidioses, las raíces que
siguen encendidas bajo la capital, y el Sinluz que llega después.

**Stack:** React 19 · TypeScript · Vite · Three.js (React Three Fiber) · GSAP ScrollTrigger + SplitText

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

Lo intuitivo sería mapear el progreso total (0 a 1) a los cinco encuadres. No
funciona: el hero y el cierre también ocupan scroll, así que la cámara siempre va
corrida y nunca llega al encuadre del capítulo que estás leyendo.

Por eso `scrollState.position` no sale de una regla de tres sino de la posición
real de cada sección: App mide a qué altura queda centrada cada una y
`writeScroll()` interpola entre esas anclas. Cuando el capítulo IV está en el
medio de la pantalla, la cámara está exactamente en el encuadre del IV.

Y como todo el mundo 3D lee ese mismo número, los umbrales se leen como lo que
son: el Árbol se apaga *entre el capítulo I y el II*, el núcleo se enciende
*llegando al IV*.

## Estructura

```
src/
├── App.tsx              # ScrollTrigger maestro + layout de la página
├── story.ts             # TODO el contenido: texto y recorrido de cámara
├── scrollState.ts       # el puente GSAP ⇄ 3D + utilidades (lerp, damp)
├── index.css            # paleta, tipografía, capas
├── components/
│   ├── Chapter.tsx       # sección con revelados de SplitText
│   └── ChapterRail.tsx   # riel de capítulos (elemento de firma)
└── world/
    ├── World.tsx         # canvas fijo, luces, niebla, calidad
    ├── Sky.tsx           # el domo de cielo, con el halo del Árbol
    ├── Post.tsx          # la cadena de postprocesado
    ├── quality.ts        # los tres niveles y el ajuste automático
    ├── Terrain.tsx       # el suelo, con roca y hierba triplanar
    ├── Grass.tsx         # el pasto instanciado, con viento en el shader
    ├── Rocks.tsx         # las pedreras
    ├── Erdtree.tsx       # el Árbol Áureo: ramas, hojas, luz y sombra
    ├── BrokenRing.tsx    # el Anillo, que la Fractura parte en tres
    ├── Core.tsx          # la luz encendida en la pared del acantilado
    ├── CameraRig.tsx     # la cámara interpolada por el scroll
    ├── erdtree/branches.ts    # el Árbol, generado por recursión
    └── terrain/
        ├── noise.ts           # ruido de gradiente y sus octavas
        └── heightfield.ts     # el relieve y la consulta de altura
```

**Para reescribir la historia o cambiar el recorrido, editá solo `src/story.ts`.**

El recorrido está hecho de **estaciones**: puntos donde la cámara se detiene, con
el viaje interpolado entre una y la siguiente. Y una estación no tiene por qué
llevar texto. Las que no lo llevan son **respiros**: el lector sigue bajando, el
mundo se mueve y no hay nada que leer.

Sirven para dos cosas a la vez. Dejan respirar la lectura, y le dan a la cámara
puntos intermedios por donde pasar: con cinco puntos sueltos, el viaje entre uno y
otro es una recta larga que atraviesa el mundo sin que nadie la conduzca. Añadir
un respiro es añadir un nodo a esa curva.

## Detalles que vale la pena mirar en el código

- `useGSAP()` en vez de `useEffect`: limpia las animaciones al desmontar. Sin eso,
  ScrollTrigger acumula instancias muertas en cada recarga en caliente.
- El `scope` de `useGSAP` limita los selectores a cada componente. **Pero el scope
  no alcanza a SplitText**, que resuelve los strings con su propio
  `querySelectorAll` sobre el documento entero: con un selector, cada capítulo
  terminaba partiendo los cinco títulos de la página. Por eso `Chapter.tsx` le pasa
  el elemento por ref.
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
  que haya planos intermedios entre el ojo y él (ruinas, llanura, montañas), y que
  la bruma lo lave como lava todo lo lejano. Con eso, unas columnas de seis
  unidades en primer plano dicen sin decir nada que el Árbol mide ciento treinta.
- **El terreno es un abanico de anillos, no una cuadrícula.** Los radios crecen al
  cuadrado, así que casi todos los vértices caen donde está la cámara y el
  horizonte se lleva cuatro. Cubrir 290 unidades con una cuadrícula uniforme y el
  mismo detalle cerca costaría un millón de vértices; así son cuarenta y seis mil.
- **Las cámaras viven dentro del terreno.** En cuanto una se sale del borde, se ve
  el límite del mundo y el suelo se lee como una isla de juguete.
- `prefers-reduced-motion` se respeta con una regla simple: **el mundo solo se mueve
  cuando el usuario scrollea**. Se apaga el movimiento autónomo (el Árbol, el
  Anillo, el viento en la hierba, el latido de las raíces, el titileo de las
  estrellas, el grano de película, la inercia de la cámara, el parallax y los
  revelados de texto) y se deja lo que responde al scroll. Comprobado comparando
  dos capturas separadas en el tiempo: salen idénticas byte a byte, salvo por el
  ruido del denoiser de la oclusión ambiental, que cambia de un frame a otro por
  debajo del umbral de lo perceptible.

## Qué sigue

Ver **[PLAN_DE_DESARROLLO.md](./PLAN_DE_DESARROLLO.md)**.
