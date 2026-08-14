# Bitácora — lo que pasó, y lo que costó averiguarlo

Registro de sesiones. Lo que queda por hacer está en **[PLAN.md](./PLAN.md)**.

Esto no es un changelog de commits: para eso está el `git log`. Acá van las
**decisiones** y las **trampas**, que es lo que no se deduce mirando el código
después. Casi todo lo que hay abajo costó una tarde de buscar en el sitio
equivocado.

---

## Las decisiones de fondo

Cuatro, y explican por qué el proyecto es como es.

### Todo es geometría, nada es imagen

El plan original repartía papeles: el cielo y la ciudad lejana serían capturas
del juego recortadas en planos; solo el Árbol y el terreno cercano serían
geometría. Se descartó entero.

El motivo es que una capa plana no tiene paralaje propio, no recorta los rayos
de luz, no proyecta ni recibe sombra y a poco que la cámara se mueva se delata.
Y sobre todo: **una imagen fotorrealista detrás de geometría simple hace que la
geometría parezca un juguete**. Peor que no tenerla.

Lo que se hizo en su lugar fue subir el nivel de la geometría hasta que se
sostenga sola. Ver «las cuatro palancas».

### La forma la tiene que decidir un proceso, no una fórmula

Es la pista que ordenó todo el trabajo de realismo. El Árbol nunca se leyó como
maqueta, y las mesetas del proyecto original sí, aunque las dos eran geometría
simple. La diferencia: la forma del Árbol sale de ramificarse, y la de la meseta
de un cilindro.

**Cuando la forma la genera un proceso, se lee como natural; cuando la genera
una primitiva, se lee como maqueta.** De ahí salieron el terreno por ruido, las
piedras abolladas, las columnas con los bordes comidos y la cordillera por
plegamiento.

La excepción son las ruinas, y a propósito: son la única geometría a la que se
le permite ser recta, porque la hizo alguien. Ahí la credibilidad viene del
desgaste y sobre todo de la disposición — las columnas de un mismo sitio guardan
la fila y el espaciado, porque sostuvieron el mismo techo.

### HDRI, PBR y GLTF: qué entra y qué no

Tres técnicas que suelen nombrarse juntas y rinden muy distinto acá.

- **Iluminación por entorno: sí, y sin descargar nada.** `Environment` de drei
  acepta paneles emisivos (`Lightformer`) y genera el mapa en la propia escena:
  un disco dorado arriba (el Árbol), un panel verdoso de cielo alto y un rebote
  pardo desde abajo. Un `.hdr` de archivo solo compensaría para reflejos
  reconocibles en superficies pulidas, y acá casi todo es roca mate a contraluz.
- **Texturas PBR: sí, pero selectivas.** Un set completo son 2-4 MB por material
  y aquí la roca se ve casi negra la mayor parte del tiempo. Lo que rinde es el
  **normal map**, para que la piedra deje de ser una superficie lisa. Dos
  materiales de Poly Haven a 1K, convertidos a WebP: 965 KB en total.
- **Modelos GLTF: al final no.** Se contemplaban para las ruinas y las torres.
  Generadas quedaron mejor: se controlan por parámetros, no pesan nada, y las
  mismas piezas sirven para las ruinas del suelo y para la ciudad que flota.

### Nueve capítulos, y el orden lo decide también la cámara

Esto no es obvio. La historia empieza y termina mirando al Árbol, al norte, así
que **cualquier capítulo que mire a otro lado hay que pagarlo dos veces**, a la
ida y a la vuelta.

Ordenados por cronología, el recorrido zigzagueaba y la cámara daba dos vueltas
de ciento ochenta grados, que se sienten como un latigazo por mucho que se
repartan. Reordenados —Caelid al este, las raíces abajo, Farum Azula al sur, el
Árbol Sagrado al suroeste— da **una sola vuelta entera** y vuelve al norte por
el otro lado: trescientos sesenta grados repartidos en dieciocho estaciones son
sesenta por tramo.

Y el orden nuevo cuenta mejor: el este arrasado, la luz que sigue abajo, la
ciudad que recuerda que hubo otras órdenes, el intento que se congeló, y solo
entonces la decisión de quemarlo todo.

---

## Las cuatro palancas del realismo

Por orden de impacto, y las cuatro hechas.

1. **Sombras y oclusión ambiental.** Sin sombra proyectada nada pesa: los
   objetos parecen calcomanías delante del fondo por buena que sea su forma. La
   sombra sale del Árbol y no del sol, que es de donde viene la luz que se ve:
   un foco desde la copa cuesta **un** pase de sombra, mientras que una luz
   puntual costaría seis, una por cara del cubo.
2. **Terreno generado, no primitivas.** Un abanico de anillos concéntricos con
   los radios creciendo al cuadrado: casi todos los vértices caen donde está la
   cámara y el horizonte se lleva cuatro. Cubrir 290 unidades con una cuadrícula
   uniforme y el mismo detalle cerca costaría un millón de vértices; así son
   cuarenta y seis mil.
3. **Materiales con proyección triplanar**, en dos capas: roca oscura en lo
   empinado, hierba seca en lo llano, mezcladas por la pendiente. Es lo que hace
   que se lea como paisaje y no como una piedra gigante, porque en la naturaleza
   en las paredes no crece nada. El normal map se aplica **sin tangentes**: se
   perturba la normal del mundo directamente, porque un terreno no tiene UV que
   respetar.
4. **Poblar el suelo.** Cuarenta y dos mil briznas de hierba en una llamada de
   dibujo, con el viento en el shader; piedras agrupadas en pedreras por ruido;
   y cuarenta y siete piezas de ruina en cuatro llamadas.

---

## Lo aprendido a golpes

### El tone mapping va al final de la cadena, no en el renderer

Con `EffectComposer` la escena se renderiza en HDR y los valores por encima de 1
sobreviven hasta el volcado final. Sin un paso de tone mapping no se comprimen:
**se recortan**. El resultado fue una pantalla blanca. Ahora el renderer va con
`NoToneMapping` y la cadena termina en `ToneMapping` ACES. (Se probó AgX
primero, que es más moderno, pero desatura tanto que el dorado se volvía beige.)

### El bloom se comía el cielo

Con el umbral en 0.5, medio cielo lo superaba y el efecto lo amplificaba hasta
el blanco. Está en 0.92: solo lo cruzan los materiales emisivos sin tone
mapping, que es justo lo que tiene que brillar. De paso el bloom puede ser
global en vez de selectivo, y nos ahorramos un pase de render entero.

### N8AO no convive con el multisampling

Lee el buffer de profundidad, y con MSAA ese buffer no es legible. El antialias
pasa a ser SMAA, que es un efecto y sí convive.

### Chrome congela el `requestAnimationFrame` cuando la ventana no se ve

Da 0 fps y parece que la escena se rompió. Ha costado dos veces:

- La primera con la ventana **tapada** por otra, con
  `document.visibilityState` diciendo «visible». Se arregla abriendo Chrome con
  `--disable-backgrounding-occluded-windows`.
- La segunda con la ventana **minimizada**, donde `visibilityState` sí dice
  «hidden» y ninguna bandera lo evita. Ahí no solo se para el mundo 3D: se para
  ScrollTrigger, que también corre sobre rAF, y entonces los revelados de texto
  no disparan y **parece que el texto está roto**. Antes de dar por bueno un
  fallo raro, medir `document.visibilityState` y contar frames.

### SplitText no respeta el `scope` de `useGSAP`

Resuelve los selectores con su propio `querySelectorAll` sobre el documento
entero. Con un string, cada capítulo partía los títulos de toda la página, se
pisaban entre sí y terminaban todos invisibles. Hay que pasarle el elemento por
ref.

### Iterar los generadores sin abrir el navegador

Los módulos de terreno, árboles y ruinas son funciones puras. Se compilan con
esbuild a CommonJS y se ejecutan en Node: es el código real, no una copia, y
devuelve al instante el número de ramas, la altura, el radio de la copa o la
altura del suelo en cualquier punto. Ahorra muchísimas idas y vueltas al
navegador para afinar un número, y sirve para comprobar cosas que en una captura
no se ven — como que trece cámaras estaban bajo tierra.

### La escala no sale de agrandar

Lo que más costó entender. Un objeto enorme y cercano se lee como un objeto
normal: lo que comunica el tamaño es **la distancia percibida**, y esa la dan
tres cosas juntas. Que esté lejos de verdad, que haya planos intermedios entre
el ojo y él, y que la bruma lo lave como lava todo lo lejano. Con eso, unas
columnas de seis unidades en primer plano dicen sin decir nada que el Árbol mide
ciento veinte.

---

## Sesión por sesión

### 0 · El esqueleto — 13 de agosto

La primera versión, generada de una vez y nunca ejecutada.

- [x] Puente GSAP ⇄ Three.js sin re-renders de React (`scrollState.ts`)
- [x] ScrollTrigger maestro que reporta progreso y capítulo
- [x] Cámara interpolada entre capítulos, con suavizado independiente del framerate
- [x] Revelados de texto con SplitText (`mask`) y parallax con `scrub`
- [x] Riel de capítulos, barra de progreso
- [x] `prefers-reduced-motion` respetado en todo
- [x] Responsive básico y meta tags Open Graph

### 0.1 · Primera pasada por el navegador — 13 de agosto

Varias cosas no hacían lo que decía el código.

- [x] SplitText partía los cinco títulos desde cada capítulo: quedaban
      invisibles hasta llegar al último (ver arriba)
- [x] Al recargar a mitad de página la cámara arrancaba en el capítulo I y
      volaba hasta donde estabas: faltaba escribir el estado en `onRefresh` y
      plantar la cámara en el primer frame
- [x] `chapter` se calculaba con `round` y `chapterProgress` con `floor`:
      hablaban de capítulos distintos
- [x] `velocity` se quedaba congelada con el último valor al soltar el scroll.
      Ahora decae sola y mueve un poco el FOV cuando bajás rápido
- [x] El riel se quedaba marcando un capítulo viejo al saltar el scroll de golpe
      (`onToggle` no dispara en los saltos; `onEnter`/`onEnterBack` sí)
- [x] ScrollTrigger medía con la fuente de sistema y no volvía a medir cuando
      llegaban las de Google: los capítulos disparaban corridos
- [x] `100vh` saltaba con la barra de URL en móvil (`svh`, y `ignoreMobileResize`)
- [x] El texto no se podía seleccionar (`pointer-events: none`), y arreglarlo
      dejaba sin deriva a la cámara: el canvas escucha en `document.body`
- [x] El riel era un `<nav>` de elementos inertes: ahora son botones, con
      `aria-current` y foco visible
- [x] Movimiento reducido de verdad en el mundo 3D
- [x] Favicon (era un 404 en cada carga), `theme-color`, `noscript`
- [x] `three`, `r3f` y `gsap` en chunks aparte, y tsconfig más estricto

### 0.2 · Elden Ring — 13 de agosto

El proyecto nació como *Aureth*, un reino inventado de islas flotantes. Pasa a
contar la caída de la Orden Áurea. El motor es el mismo: cambió la historia, la
paleta y lo que hay en la escena, no la arquitectura.

- [x] Historia nueva en `story.ts`, paleta de oro y ámbar sobre bruma parda
- [x] El Árbol Áureo y el Anillo de Elden
- [x] La cámara se sincroniza con las secciones reales y no con el progreso
      total: antes nunca llegaba al encuadre del capítulo que estabas leyendo
- [x] Los umbrales de la escena se declaran en capítulos, no en porcentajes
- [x] Aviso de proyecto de fan en el cierre

### 0.3 · El salto visual — 13 de agosto

La tanda larga. Postprocesado completo, el Árbol por recursión, y el mundo
alrededor.

- [x] **Postprocesado**: N8AO, GodRays, Bloom, DepthOfField, aberración,
      grading, tone mapping ACES, SMAA, viñeta y grano. Con tres niveles de
      calidad (`?q=high|medium|low`) y ajuste en caliente con `PerformanceMonitor`
- [x] El cielo entra al canvas como domo: con postprocesado, un degradado CSS
      por detrás dejaría el fondo limpio y la costura se vería
- [x] **El Árbol por recursión**, en un solo `InstancedMesh`
- [x] **Terreno continuo** en abanico de anillos, con roca y hierba triplanar
- [x] **Hierba, piedras y ruinas**
- [x] Corrección de rumbo a mitad de sesión: *no quiero casi formas
      geométricas*. Las mesetas flotantes de *Aureth* se retiran; el mundo de
      las Tierras Intermedias no flota
- [x] Las cámaras se meten dentro del terreno: en cuanto una se sale del borde,
      se ve el límite del mundo y el suelo se lee como una isla de juguete
- [x] El Árbol a la escala que le toca: lejos, con planos intermedios y la bruma
      comiéndole la base

Dos ajustes que hubo que hacer contra el navegador: **el tronco se bifurcaba a
ras del suelo** y el Árbol se desmoronaba hacia un lado (los primeros niveles se
abren mucho menos, y más tarde se añadió un tramo de tronco de verdad); y **las
hojas salían de píxel y medio**, porque la escala del tamaño de punto va en
cientos, no en decenas.

### 0.4 · Nueve capítulos — 13 de agosto

- [x] Cuatro capítulos nuevos: **Caelid**, **Farum Azula**, **el Árbol Sagrado**
      y **la Llama de la Ruina**
- [x] Dieciocho estaciones: nueve capítulos y nueve respiros
- [x] El orden nuevo, que da una sola vuelta de cámara (ver arriba)
- [x] `world/mood.ts`: los cuatro cambios del mundo en un solo archivo, como
      funciones puras de la posición. Estaban repartidos por seis componentes, y
      los umbrales son números de estación: una estación nueva en el medio los
      corría todos y la corrección se olvidaba en alguno
- [x] `world/Atmosphere.tsx`: niebla, luz de relleno y color de los rayos atados
      a esos estados. **No con un filtro de color en el postprocesado**: un
      filtro tiñe igual lo cercano y lo lejano, y lo que hace creíble un cambio
      de luz es justamente que no
- [x] `world/Haligtree.tsx` y `world/Azula.tsx`, con la cantería de las ruinas
      extraída a `ruins/pieces.ts` y compartida
- [x] El Árbol ya no se apaga con la Fractura, que es lo que decía antes y no es
      lo que pasa: ahí se rompe el Anillo. Se apaga cuando alguien le prende
      fuego, y de ahí queda el esqueleto contra un cielo negro
- [x] La cordillera: las crestas llevan amplitud propia y se muestrean a
      distinta frecuencia en cada eje. Eran conos iguales; ahora son líneas de
      cumbres de alturas distintas, que es lo que hace un plegamiento
- [x] El Anillo, más grueso: a 250 unidades el anterior salía en menos de un píxel
- [x] El halo del cielo apuntaba al origen y no al Árbol

### 0.5 · El encuadre vertical — 14 de agosto

Primera vez que se mira la página en un teléfono. Salieron dos fallos, y el
primero llevaba semanas ahí sin que se viera.

- [x] **Trece de las dieciocho estaciones ponían la cámara bajo el suelo.** La
      corrección de vertical escalaba el vector cámara→mirada en 3D para «tomar
      distancia», y casi todos los encuadres miran hacia arriba: hacia atrás a
      lo largo del eje de vista es también hacia abajo. Un 42% de una mirada que
      sube cuarenta unidades son dieciocho de caída.

      **Y no se veía como un fallo.** El terreno solo tiene cara de arriba, así
      que desde abajo no se dibuja: lo que aparece es un mundo sin suelo, y uno
      se pone a buscar la causa en la niebla o en las luces.
- [x] Ahora hay cuatro correcciones, cada una en el eje que le toca: el
      retroceso solo en horizontal y con tope; la mirada baja un **ángulo** y no
      unas unidades de mundo (dos y media son medio grado en un plano lejano y
      seis en uno cercano); el lente se abre once grados, que es la única que no
      se puede hacer moviendo la cámara; y una red de seguridad que impide que
      la cámara baje del suelo
- [x] El rune heredaba el tracking de `.chapter__label` (0.24em) y «VIII» pasaba
      de 26 a 37 píxeles dentro de un círculo de 28: se comía la separación y se
      leía «VIIILA LLAMA»
- [x] Los dos planes se fusionan en uno. Se solapaban en un setenta por ciento y
      varias casillas hablaban de cosas que ya no existen

### 0.6 · La entrada — 14 de agosto

- [x] **El mundo 3D se carga aparte y después** (`React.lazy`). Lo que bloquea
      el primer pintado pasa de 549 a **118 KB gzip**, y el primer pintado a
      84 ms. El total no baja: son los mismos bytes, llegando cuando ya no
      estorban
- [x] **El preloader**: una runa dorada —el Anillo partido con el Árbol
      dentro— dibujándose sola con DrawSVG, y un destello que abre el mundo.
      La entrada del título se traslada aquí: antes se gastaba a oscuras, y
      ahora es el remate del momento
- [x] La entrada trae dos redes de seguridad, y las dos hacen falta: un tope de
      seis segundos por si el mundo no avisa nunca, y `ScrollTrigger.refresh()`
      al abrir, porque mientras el `body` va con `overflow: hidden` el scroll
      máximo es cero y ScrollTrigger midió con ese cero

**Lo que costó averiguarlo: el ayudante de precarga de Vite.** Poner `lazy` no
sirvió de nada al principio, y el HTML seguía precargando `three` y `r3f`. Dos
capas de causa, una encima de otra:

1. **React acabó dentro del chunk de r3f.** `manualChunks` en su forma de lista
   de paquetes no llega a `react/jsx-runtime`, que es un fichero aparte dentro
   del mismo paquete: el chunk de React salía de cero bytes y el runtime de JSX
   se quedaba con r3f. Como la página necesita React desde el primer momento,
   arrastraba r3f entero, y r3f arrastra three. Se arregla pasando
   `manualChunks` a su forma de función.
2. **Y aun así seguía.** El culpable era `__vitePreload`, la función que Vite
   inyecta para precargar las dependencias de un `import()` dinámico. Veinte
   líneas, y Rollup las había puesto dentro del chunk de r3f: la entrada
   importaba medio mega para llamar a una función. Se arregla asignándole chunk
   a mano en `manualChunks`, buscando `preload-helper` en el id.

La lección general: **`lazy` no garantiza nada por sí solo.** Hay que mirar los
`modulepreload` del HTML compilado y los `import` del chunk de entrada, porque
un solo símbolo compartido basta para volver estático lo que creías diferido.

Y otra vez la misma trampa de siempre: a mitad de la comprobación pareció que la
runa no se dibujaba —el `stroke-dasharray` congelado en el 0%— y era la ventana
de Chrome minimizada por las compilaciones. Sin `requestAnimationFrame` no corre
el ticker de GSAP. Tercera vez.

### 0.7 · Scroll con inercia — 14 de agosto

- [x] **ScrollSmoother**, con `smooth: 0.8` y sin suavizado en táctil (en un
      móvil el sistema ya da inercia, y sumarle otra encima resbala)
- [x] El salto desde el riel lo hace el propio smoother. Con el scroll
      suavizado, la posición de la ventana y la que se ve son dos cosas
      distintas, y animar la primera deja al lector mirando otro sitio

**El miedo era que el mundo se desincronizara del texto**, que es el fallo que
ya se arregló una vez. No pasa, y por una razón que hubo que ir a leer al código
de GSAP: el getter que ScrollSmoother registra como `scrollerProxy` devuelve
`-currentY`, la posición **ya suavizada**, no la real. Así que `self.scroll()`
sigue entregando lo que el lector ve y el puente no se entera del cambio.
Comprobado: capítulo centrado a 0 px de desfase, riel correcto, 181 fps.

**Lo que sí hubo que arreglar es un orden de efectos.** ScrollSmoother cambia el
`scroller` por defecto de ScrollTrigger *al crearse*, y lo que se registró antes
se queda apuntando a la ventana. React ejecuta los efectos de los hijos antes que
los del padre, así que los dieciocho capítulos creaban sus disparadores antes de
que App creara el smoother. Se resuelve con un permiso: App crea el smoother en
su efecto de layout y enciende un `armed` en un efecto pasivo —que sí corre
después—, y los capítulos no registran nada hasta tenerlo.

De paso salió un fallo latente que llevaba ahí desde el principio:
`toggleActions` solo actúa al cruzar el borde, así que un capítulo cuyo
disparador se crea cuando ya está dentro de la pantalla —al recargar a mitad de
página— no revelaba su texto nunca. Ahora hay un `onRefresh` que lo adelanta al
final si ya está dentro.
