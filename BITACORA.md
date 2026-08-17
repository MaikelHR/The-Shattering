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

### 0.8 · La Fractura — 14 de agosto

El tercero de los cinco momentos, y el que más se echaba de menos. La sección
del capítulo II se clava metro y medio de pantalla y ese tramo conduce una
timeline con `scrub`: la grieta se dibuja desde donde está el Anillo, el mundo
pierde el color y la luz, un destello lo tapa todo, y al salir el Anillo está
partido en tres. Todo bajo el dedo, hacia adelante y hacia atrás.

- [x] `components/Fracture.tsx`: el pin, la grieta con DrawSVG y el destello
- [x] `shock` en `world/mood.ts`: el golpe que leen el Árbol, la niebla, el
      cielo, el Anillo y el postprocesado
- [x] Las anclas de cámara cuentan con el espaciador del pin

**Se clava con `pin` y no con `position: sticky`**, que habría sido más simple.
Sticky no funciona aquí: ScrollSmoother mueve el contenido con un `transform`,
y un elemento pegajoso dentro de algo que se transforma se mueve con ello.

**Y el pin obliga a corregir la medida de las anclas.** ScrollTrigger mete la
sección dentro de un `pin-spacer`, y es el espaciador el que ocupa los dos
metros y medio de scroll mientras la sección se queda quieta dentro. Midiendo la
sección, su centro caía al principio del tramo clavado: la cámara llegaba al
encuadre del capítulo II antes de que empezara la Fractura y se iba justo cuando
ocurría. La corrección es una línea —medir el espaciador si existe— pero hay que
verla venir.

Lo que salvó el resto: **con ScrollSmoother, el pin de ScrollTrigger no usa
`position: fixed` sino transformaciones** (la comprobación está en el `pinType`
del `scrollerProxy`, que ScrollSmoother no declara y por eso sale `transform`).
Como `offsetTop` es una propiedad de layout y las transformaciones no la tocan,
las otras diecisiete anclas siguieron siendo válidas sin tocar nada.

**El color se va con un filtro, y es la primera vez que se hace así.** En todo
el resto del proyecto la regla es la contraria —el mundo cambia de color porque
cambia la luz, no porque haya un filtro encima—, y aquí se rompe a propósito: en
la Fractura no es que la luz cambie de color, es que deja de haber color. Eso es
saturación, y la saturación es un filtro. Va con la niebla y el cielo yéndose a
ceniza al mismo tiempo, para que no se lea como un efecto pegado.

Un último detalle que casi se cuela: con movimiento reducido la timeline de la
grieta no se crea, así que los trazos se habrían quedado **dibujados y quietos**
en mitad de la pantalla para siempre. Ahora, con movimiento reducido, la grieta
y el destello ni se pintan; el golpe del mundo sí sigue, porque lo mueve el dedo
del lector y no un reloj.

### 0.9 · Las raíces y el otro árbol — 14 de agosto

Dos sitios que se veían mal, y los dos por un motivo que se podía medir.

**El capítulo de las raíces era un icosaedro con una luz dentro**, y se leía como
lo que era: una piedra que brilla. Ahora hay raíces, y salen del mismo generador
que los dos árboles: una raíz **es** un árbol que crece hacia abajo. Tercera vez
que se usa el generador, y la que mejor lo justifica.

Costó tres intentos, y los dos primeros fallaron por lo mismo:

1. Con los números de siempre —muchas generaciones, mucha bifurcación— salieron
   **matas**: bolas de ramitas que dentro de una grieta de quince unidades de
   ancho tapaban el hueco entero y se leían como coral.
2. Encima estaban a veinticinco unidades del ojo y a escala 1,5. Una masa de
   veinte unidades ahí ocupa medio encuadre.

Lo que funcionó fue **invertir la forma**: siete de las ocho generaciones en
régimen de tronco, así que en vez de copa sale un cable de dieciocho unidades que
cruza la grieta de pared a pared soltando raicillas. Cuarenta y cinco ramas en
vez de novecientas, así que caben ocho a distintas alturas y profundidades — y lo
que hace que se lea el hondo no son las raíces sino que se crucen unas por
delante de otras.

Dos detalles más. Los anclajes se calculan con la propia función de altura del
terreno (`groundHeight(x, z) - 1.6`) en vez de escribirlos a mano, así que la
base queda enterrada aunque cambie el relieve: al aire se veía el tocón flotando.
Y la orientación va por **cuaternión desde una dirección** y no por ángulos de
Euler, porque lo que uno quiere decir es «crece hacia allá», no «gira π en X y
0,4 en Z».

**El Árbol Sagrado parecía un brócoli**, y la causa era medible: tenía el **42%
de su altura en tronco pelado** contra el 16% del Áureo, porque llevaba cinco
generaciones de tronco antes de abrirse. Bajando a tres, el tronco pelado cae al
21% y la copa ocupa el resto. La otra mitad del problema eran las hojas: dos mil
motas de metro y medio en una copa de cincuenta se solapan hasta formar bolas.
Reducidas a un tercio y más translúcidas, la silueta la lleva el ramaje, que es
lo que hay que ver.

La lección que sirve para la próxima: **cuando algo «se ve raro», casi siempre
hay una proporción que lo dice.** Medir el tronco pelado contra el que sí se ve
bien fue más rápido y más seguro que probar valores a ojo.

### 0.10 · El mundo alrededor — 14 de agosto

- [x] **La capital**, `Capital.tsx`: una muralla curvada con sus torres, una
      puerta, las agujas de la ciudad detrás y una torre mayor corrida a un
      lado. Unas ciento veinte piezas en tres llamadas de dibujo
- [x] **Nubes** en el shader del cielo
- [x] **Niebla exponencial** en vez de lineal
- [x] `ruins/Batch.tsx`: el componente que vuelca matrices en un
      `InstancedMesh`, que estaba copiado en las ruinas y en Farum Azula y
      estaba a punto de estarlo por tercera vez

**La capital no es decoración: es lo que hace que el Árbol se vea enorme.** Un
objeto grande y lejano no se lee como grande por sí solo; hace falta algo entre
el ojo y él a lo que el ojo le conozca el tamaño. Había ruinas a cincuenta
unidades y montañas a ciento cincuenta, y en medio nada. La capital ocupa ese
hueco.

Dos cosas que hubo que corregir contra el navegador, las dos de escala:

- **Era un tercio demasiado grande** y tapaba la cordillera entera. Las alturas
  bajaron de 15-30 a 10-20 y la muralla se alejó ocho unidades.
- **La torre mayor estaba centrada**, justo delante del tronco del Árbol, y se
  lo comía. Corrida dieciocho unidades a un lado, se leen las dos.

De las nubes, lo único que tiene truco es la proyección: la dirección de la
vista se divide por su propia altura (`dir.xz / dir.y`), que es proyectarla
sobre un plano horizontal. Eso hace que se aplasten hacia el horizonte igual
que las de verdad, sin más código. Por debajo de unos veinte grados se apagan,
porque ahí esa división estira tanto el ruido que se ve el patrón. Y el color
sale del propio cielo aclarado, así que se tiñen solas con la podredumbre y con
el incendio sin un uniform aparte.

180 fps con todo puesto.

### 0.11 · La atmósfera viva — 14 de agosto

- [x] **Hojas doradas** (`Leaves.tsx`), en tres tamaños
- [x] **El aire cambia con la historia**: ceniza saliendo de Caelid, y motas
      que **suben** en el barranco
- [x] **Los rayos**, con el emisor más gordo y el efecto con más peso
- [x] **Sonido sintetizado**, con botón y apagado por defecto

**Las hojas envuelven a la cámara, no la siguen.** Es la única parte con truco.
Si el campo siguiera a la cámara sin más, las hojas viajarían con ella y no
habría paralaje: se leerían como suciedad en el objetivo. Lo que hace el shader
es envolver cada hoja alrededor de la cámara con un `mod`, así que cuando una se
sale por un lado de la caja entra por el otro. El campo resulta infinito
costando novecientas hojas, y cada hoja se queda donde está mientras la cámara
pasa. El salto del envoltorio ocurre en el borde de la caja —lejos y con
niebla—, así que no se ve.

Y de paso los tres tamaños: las grandes van cerca y el desenfoque del
postprocesado las disuelve, las pequeñas van lejos y nítidas. Con un tamaño
solo se ve una cortina; con tres, un volumen de aire.

**La trampa de la sesión: `half` es palabra reservada en GLSL.** Escribí
`vec3 half = uBox * 0.5;` y el shader no compiló. Lo que se ve entonces no es un
error de compilación con su mensaje, sino ciento noventa avisos de
`useProgram: program not valid` y las hojas que sencillamente no están. Antes de
buscar en la lógica, revisar los nombres de las variables del shader.

**El sonido va sintetizado y es la decisión que más se parece al resto del
proyecto.** El viento es ruido rosa por un pasa-banda con dos osciladores
lentísimos y desincronizados moviéndole la frecuencia —con uno solo, el viento
respira como un metrónomo—; el zumbido de las raíces son dos senos desafinados
entre sí más un armónico bajo; y el golpe de la Fractura es un barrido de 110 a
28 Hz con un soplo de ruido filtrado encima. Cero kilobytes contra los ciento
cincuenta de un bucle en opus, y además se ajusta a la historia leyendo
`mood.ts` en vez de repetirse igual.

Arranca **apagado**, y no solo por el autoplay: una página que suena sola sin
avisar es una grosería. La elección se recuerda, y ahí hay un detalle que casi
se cuela: si alguien la dejó encendida y **recarga**, el componente crea el
`AudioContext` sin que nadie haya tocado la página, el navegador lo deja
suspendido —con razón— y el botón diría que está encendido sin que se oiga nada.
Ahora, si nace suspendido, se queda esperando el primer gesto para despertarlo.

**Lo que no puedo comprobar: cómo suena.** Puedo verificar que el grafo se
construye, que el botón alterna, que la elección persiste y que no hay errores;
oírlo, no. Los niveles van conservadores por eso.

---

### 0.12 · El texto, coreografiado — 15 de agosto

- [x] **SplitText por líneas** con `autoSplit`, en vez de por palabras
- [x] **Entrada direccional**: el texto entra por el lado en el que vive
- [x] **ScrambleText en los nombres** de los semidioses
- [x] **CustomEase para la cámara**, medida contra los codos del recorrido

**Por líneas y no por palabras.** Una línea es una unidad de lectura; una
palabra suelta no significa nada. El cambio obliga a `autoSplit`, porque las
líneas dependen del ancho y de la fuente: un título partido con la fuente del
sistema se queda con los cortes de esa fuente cuando llega la buena, y al girar
un teléfono quedan líneas de una sola palabra.

Y `autoSplit` trae su propia trampa. `onSplit` vuelve a correr en cada
re-partición, y esas pasadas ocurren **fuera del contexto de `useGSAP`**, donde
un selector como `'.chapter__label'` deja de estar limitado a esta sección y
alcanza a las dieciocho de la página. Es la misma trampa de la sesión 0.1 con
SplitText, con otra puerta de entrada: ahora todo se resuelve a elementos antes
de construir nada. Comprobado con doce re-particiones seguidas: 31 disparadores
de ScrollTrigger antes, 31 después. `split.revert()` mata la timeline vieja con
su disparador dentro, así que no se acumulan.

**Las máscaras recortan por el borde del relleno.** Con `line-height: 1.04`, el
recorte cae justo encima de la línea de base y la «j» de «bajo» se queda sin
cola. Se le da aire por los cuatro lados y se compensa con margen negativo: el
recorte se abre y el hueco del título no cambia. Y hace falta darle una clase
propia a las líneas, porque sin `linesClass` las líneas salen sin `class` y las
máscaras que GSAP les pone encima también: no hay de dónde agarrarlas.

**El fallo que encontré escribiendo esto: un nombre revuelto se anuncia.**
Mientras dura el efecto el texto del documento dice «Godkifw», y eso es lo que
lee un lector de pantalla si le toca el párrafo en ese segundo. Ahora cada
nombre va dos veces: el que se revuelve lleva `aria-hidden` y al lado hay una
copia quieta que solo existe para quien escucha. Comprobado recorriendo el
árbol en pleno revuelto: en pantalla «Godkifw», anunciado «Godrick». El precio
es que copiar el párrafo duplica el nombre, y es más barato que anunciar una
palabra que no existe.

De paso, el revuelto cambia el ancho de la palabra —las letras que entran son
otras y más angostas— y sin fijarlo el párrafo entero tiembla. Se le fija el
ancho durante el efecto y se suelta al terminar.

**La curva de cámara salió de medir, no de gusto.** El recorrido es una
polilínea y los codos son duros: al pasar por la estación 2 la trayectoria gira
**159 grados**, por la 8 gira 153 y por la 15, 148, con una mediana de 73. Y los
tramos no miden lo mismo: el más largo son 67 unidades y el más corto 4,6,
catorce veces y media. Interpolando en recto, la cámara llega a toda velocidad,
cambia de sentido en un frame y sale a toda velocidad.

La curva elegida sale a 0,45× y llega a 0,20×. Medido sobre el recorrido
entero, el salto de velocidad al cruzar una estación baja **de 51 a 27 unidades
por estación** a cambio de un pico un 31% más alto en mitad del tramo. Probé
apretarla más: con una curva dura el salto baja a 10, pero el pico se va a 107 y
el tramo se cruza de un tirón. Cambiar un problema por otro peor.

Y hay un tercer motivo que es el que de verdad importa: **una estación es donde
el capítulo queda centrado y el lector está leyendo.** Ahí la cámara tiene que
estar quieta.

**Lo que se paga:** el primer pintado sube de 127 a 135 KB gzip. Son
ScrambleText y CustomEase, que caen en el trozo de GSAP y ese lo carga la
entrada. Sigue muy por debajo del techo de 200.

---

### 0.13 · El mapa y la cámara suelta — 15 de agosto

- [x] **El mapa final**, dibujándose con DrawSVG atado al scroll
- [x] **Los nueve puntos**, encendiéndose cuando el trazo los alcanza
- [x] **Vuelo libre** con controles orbitales limitados

Con esto quedan hechos **los cinco momentos** que la página se propuso tener.

**El mapa está en las coordenadas del mundo 3D.** El Árbol al norte, la
capital a sus pies con la misma curva de muralla que en la escena, el este
podrido, el barranco a cuarenta y siete del centro, la ciudad que flota al sur
y el otro árbol al suroeste: todo pasado por una sola proyección, que es mirar
el mundo desde arriba. No es una ilustración que se parece al mundo; es el
mundo visto de otra manera. La cordillera y las manchas se generan con ruido
estable —nada de `Math.random`, que un mapa que cambia de forma al recargar no
es un mapa— y el marco es el Anillo, roto en tres arcos, con el hueco más
ancho justo encima del Árbol.

**Dónde ocurre cada capítulo se escribe a mano, y hubo que razonarlo.** Lo
primero que probé fue sacarlo de los datos que ya existen, y no sale de
ninguno de los dos:

- De `camera`, no: la cámara casi no se mueve del centro de la llanura en toda
  la crónica —lo que cambia es hacia dónde mira—, así que el mapa habría sido
  un garabato de setenta unidades en un mundo de cuatrocientas.
- De `lookAt`, tampoco: es un punto cualquiera de la línea de mira, puesto a
  la distancia que hiciera falta para encuadrar, no donde están las cosas.

Así que `place` es un campo más de `story.ts`, al lado del texto, porque es lo
mismo que el texto: dónde pasa lo que se cuenta.

**Los puntos se encienden siguiendo el trazo.** Un `stagger` normal reparte el
tiempo por igual entre los nueve, y los tramos miden cosas muy distintas —del
barranco a Farum Azula hay cinco veces más que del Árbol a la capital—, así que
el punto se encendía con la línea a medio camino, o mucho después de haber
pasado. Ahora cada uno tiene su instante, sacado de la longitud acumulada. Y
esa longitud se mide muestreando las curvas y no en línea recta entre puntos:
la curva es más larga que la recta y el sobrante se acumula tramo a tramo.

**La ruta va curvada.** Con segmentos rectos los nueve puntos se leen como un
polígono, y un polígono es una figura, no un camino.

**El vuelo libre: el punto de giro es la única decisión que importa.** Lo obvio
—girar alrededor del centro de la llanura, que es donde el lector estuvo todo
el rato— sale mal, y se puede calcular por qué. El Árbol mide casi doscientas
unidades y está a ciento setenta y ocho al norte: desde el suelo, su copa queda
a treinta y cinco grados de altura. Mirando al centro de la llanura, que está a
cero grados, la copa se sale del cuadro por arriba —el lente abre cuarenta y
cinco, o sea veintidós y medio hacia arriba— y lo que queda es un descampado
con montañas al fondo. Fue exactamente lo que se vio en la primera prueba.

El punto de giro va a cuarenta de altura y setenta hacia el Árbol. Desde ahí la
mirada sube dieciséis grados, que es lo que hacen los encuadres escritos —la
última estación sube diecisiete y medio—, el Árbol entra entero y, de regalo,
la transición al soltar la cámara no se ve: la deja mirando casi adonde ya
estaba mirando.

**El techo del ángulo polar se recalcula en cada frame.** Es el ángulo al que
la cámara toca el suelo, y depende de lo lejos que esté: un valor fijo o la
deja flotando a treinta unidades cuando está cerca, o la mete bajo tierra
cuando está lejos.

**Dos trampas de esta sesión:**

*La rueda del ratón hacía dos cosas a la vez.* Los eventos del canvas se
escuchan en `document.body` —el texto está encima y lo tapa—, y los controles
orbitales heredaban ese destino. Ahí Chrome trata la rueda como pasiva, el
`preventDefault` no vale, y acercar la cámara bajaba también la página: al
volver, el visitante habría aparecido en el colofón sin haber ido a ninguna
parte. Pasándoles el canvas como `domElement`, el `preventDefault` funciona.

*Y la de siempre, otra vez.* Media hora persiguiendo un mapa que no se dibujaba
y un mundo en negro, hasta comprobar `document.visibilityState`: la ventana de
Chrome estaba minimizada, el `requestAnimationFrame` congelado y con él el
reloj de GSAP, así que la timeline se quedaba en el fotograma cero —donde todo
está invisible a propósito. Es la cuarta vez. El síntoma que la delata es que
un `evaluate` que espera un frame no vuelve nunca.

---

### 0.14 · Las raíces parecían varillas y el otro árbol era verde — 15 de agosto

Dos cosas que se veían mal, y las causas resultaron ser opuestas: una era de
forma y la otra, de material.

**LAS RAÍCES.** Se leían como un juego de palitos luminosos, o como una rama
del Árbol puesta ahí abajo. Dos motivos, los dos medibles:

- **Eran rectas.** El generador entrega tramos rectos con un codo duro en cada
  nudo, que es lo correcto para una rama: una rama busca la luz y va a por
  ella. Una raíz no; una raíz va rodeando lo que se encuentra. Ahora el
  generador acepta `bend`, y cada tramo se dibuja como una cadena de cuatro
  cilindros que giran siempre hacia el mismo lado —un eje de giro por rama y no
  uno por tramo, que si cambia en cada paso sale un zigzag y no un arco.
- **Casi no se afinaban.** El grosor iba de 1,2 a 0,17: una relación de **uno a
  siete**, o sea un cable. Con `taperAlong` (afinado por dentro del propio
  tramo) y `trunkTaper` (el eje adelgazando más rápido), la relación pasa a
  **uno a cincuenta y nueve**: gorda como un brazo donde entra en la roca, un
  pelo donde termina.

Los tres parámetros son opcionales y por defecto no hacen nada, así que el
Árbol Áureo sale idéntico: comprobado, 5840 ramas y 18,31 de alto antes y
después.

Y quedaba un tercer fallo, que solo se vio con la forma ya arreglada: **la luz
no distinguía lo gordo de lo fino.** El brillo del generador sube con la
generación, y como el eje de la raíz recorre ocho, su tramo final ya iba por el
80% de la escala: salía casi tan encendido como los pelos del final y el
conjunto era una masa blanca de un solo valor. Ahora el brillo se saca del
**radio**, que está guardado en la propia matriz de cada instancia. Además de
verse mejor es la lectura física correcta: lo que se ve por transparencia es lo
delgado. Un brazo de raíz es madera oscura; un pelo de raíz es luz.

**EL ÁRBOL SAGRADO.** Acá lo importante es lo que NO se tocó. Antes de cambiar
nada medí su proporción contra el Áureo, que es el que se ve bien:

| | alto | ancho | relación | tronco pelado |
|---|---|---|---|---|
| Áureo | 117 | 138 | 0,85 | 18% |
| Sagrado | 58 | 69 | 0,84 | 21% |

**La misma.** Los dos son más anchos que altos. Iba a corregir la silueta y
habría arreglado lo que no estaba roto.

Lo que estaba mal era la luz, y eran tres cosas a la vez:

- **No tenía degradado.** El Áureo lleva el nivel de cada rama en un atributo y
  la emisión sube hacia las puntas: tronco de madera, ramitas ardiendo. Este
  emitía lo mismo de arriba abajo y salía una silueta plana de un solo valor.
- **No se le veía el follaje.** Las motas medían medio metro al 34% de
  opacidad: a ciento cincuenta unidades, cuatro píxeles. Lo que quedaba era el
  esqueleto pelado, que se lee como árbol muerto en invierno y no como árbol
  que no llegó a florecer.
- **Era verde**, y eso es lo que más lo delataba. Busqué cómo es en el juego:
  la paleta de este árbol es **blanco, plata y oro sin alear** —una luz pálida
  y fría que parodia el oro del Áureo—, nunca verde. Un verde apagado contra un
  mundo dorado no lee como «otro árbol», lee como vegetación muerta. Ahora es
  hueso y plata: **el contraste con el oro se consigue quitándole color, no
  cambiándoselo**, que además respeta la regla de la paleta —no hay un solo
  azul en toda la página.

Y flotaba. La altura salía de preguntar por el suelo **en un punto**, y ahí
arriba es cordillera: bajo la huella del tronco el terreno va de 25 a 34, así
que un lado quedaba enterrado y el otro colgando cinco unidades en el aire.
Ahora se busca el punto más bajo de la huella y se hunde tres más.

171 fps de media, 60 el peor frame, y el primer pintado no se mueve: todo esto
cae en el trozo del mundo 3D, que llega aparte.

---

### 0.15 · Las notas al margen — 17 de agosto

- [x] **Cuatro marcas doradas** repartidas por el mundo, con su nota
- [x] Con esto queda cerrado **el remate**, y con él todo el plan salvo publicar

**Son la capa de abajo, no un resumen de la de arriba.** En el juego el lore no
está en los diálogos: está en la descripción de los objetos que uno encuentra, y
quien no los busca termina la partida sin enterarse. Acá igual. Los nueve
capítulos cuentan lo que pasó; estas cuatro cuentan cómo funciona el mundo donde
pasó —de qué está hecha la luz del Árbol, qué era el Anillo en realidad, qué hay
debajo de la capital, qué promete la Gracia—, y ninguna hace falta para seguir
la historia.

**No son geometría, y ese es el cambio de criterio de la sesión.** El plan decía
«requiere raycasting», que es lo primero que se le ocurre a uno: un objeto en la
escena y un rayo desde el ratón para saber cuál se pulsó. Escribiéndolo aparecen
tres problemas que no se arreglan después:

- **No se llega con el teclado.** Un objeto dentro de un canvas no está en el
  orden de tabulación, no recibe foco y no hay manera de dárselo.
- **No existe para un lector de pantalla.** Un canvas es una imagen: lo que hay
  dentro no se anuncia.
- **Y hay que resolver a mano** el hover, el foco, el cursor y el clic, que en
  un `<button>` vienen puestos.

Así que las marcas son botones de HTML de verdad, y lo único que hace el mundo
3D es proyectar cuatro puntos y moverlos a su sitio en cada frame —tres líneas
de cuenta—, escribiendo `style` directo y no estado de React, por el mismo
motivo por el que el puente con el scroll es un objeto mutable. Comprobado
tabulando: once tabulaciones desde el principio de la página (nueve del riel,
el botón del sonido, y la marca), el nombre aparece al recibir el foco, Enter
abre, Escape cierra y el foco vuelve a la marca de la que salió.

El precio de no usar rayos es que el relieve no las tapa: una marca detrás de
una montaña se vería igual. Por eso cada una **solo se enciende en el tramo en
que la cámara la tiene delante**, y ese tramo no se eligió a ojo: se calculó
dónde cae cada punto en la pantalla en las dieciocho estaciones y se
descartaron las que quedaban fuera del cuadro o debajo del bloque de texto —que
va alternando de lado, así que no vale con mirar una.

**El fallo de la sesión: el fundido se comía el tramo.** Estaba escrito por
dentro (`from` → `from + 0.5` para entrar), así que `from` pasaba a significar
«acá empieza a aparecer» en vez de «acá se ve». Las dos marcas cuyo tramo
arranca justo en su capítulo —el Anillo en la estación 0, la Gracia en la 17—
se quedaban a cero en el único sitio donde tenían que estar encendidas. Con el
fundido por fuera, `from` y `to` vuelven a querer decir lo que parece que
dicen.

Y una cosa que no es técnica: **una luz dorada en un paisaje lleno de luces
doradas es paisaje.** Nada decía que se pudiera pulsar. Ahora la marca enseña
su nombre al pasar por encima y al recibir el foco, y el colofón lo menciona.

Con la cámara suelta se encienden las cuatro a la vez: ahí la historia está
parada, el tramo no significa nada, y buscarlas es la excusa para dar la vuelta
al mundo.

171 fps de media, cero errores, primer pintado 140 KB gzip.

---

### 0.16 · Antes de publicar — 17 de agosto

- [x] **Los seis blancos táctiles a 44 píxeles**
- [x] **Aviso cuando el navegador no puede dibujar en 3D**
- [x] **`og:image`**, que era lo único que faltaba para que el enlace se vea

**Seis, no tres.** Había mirado tres a ojo y me faltaban la mitad. Medidos
todos los elementos con los que se puede interactuar, **los seis fallaban, y
todos por el alto**: el enlace del riel 27, el botón de sonido 40, la marca de
lore 38, «cerrar» 36, «soltar la cámara» 38 y «volver a la crónica» 33. La
recomendación es 44 en los dos ejes.

Lo interesante es que **ninguno podía crecer a lo visible sin romper algo**. El
círculo del riel mide 27 porque tiene que caber un «VIII»; el punto de una
Gracia mide ocho píxeles porque es una luz, no un botón. Así que el aumento va
todo en relleno invisible, y en el riel además hay que devolver lo que se
llevó: el hueco entre elementos baja de 22 a 5 para que la distancia entre
centros siga siendo 49. Comprobado después: 49 sigue siendo 49, el riel sigue
centrado y la línea vertical sigue naciendo dentro del primer círculo y
muriendo dentro del último.

**Sin WebGL la página aguantaba, pero mal.** Simulando un equipo sin
aceleración —un portátil viejo, una máquina virtual, la aceleración
desactivada— el texto, el riel y el cielo seguían ahí y la crónica se leía
entera: la arquitectura de «el texto primero» paga exactamente aquí. Pero tres
cosas fallaban:

- **Ocho errores en consola.** El renderer de three intenta crear el contexto
  igual y lanza una excepción por intento.
- **Seis segundos de espera.** La entrada solo se levantaba por el tope, porque
  el aviso de «mundo listo» llega desde un frame que no iba a llegar nunca.
- **Y nadie decía por qué no hay paisaje.**

Ahora se pregunta antes de montar nada. Sin WebGL no se monta el motor —cero
errores—, la entrada se abre en 3,3 segundos y el hero lleva una nota al pie
explicando qué pasa. Con un detalle que casi se me escapa: **el cielo en
degradado lo pinta el CSS del div del mundo**, que vive dentro del componente
3D. Sin montarlo, la página se quedaba en negro plano. Va puesto vacío, y lo
que falta se lee como una noche cerrada y no como un error.

**La `og:image`** es una captura del capítulo VIII a 1200×630: el Árbol
ardiendo bajo el Anillo roto, con el bloque de texto de «Hay que quemar el
Árbol». En JPEG y no en PNG —118 KB contra 534, y a tamaño de miniatura no se
distinguen—, y con el riel, la barra de progreso y el botón de sonido
escondidos para la toma, que a ese tamaño son ruido. El `twitter:card` sube por
fin de `summary` a `summary_large_image`.

**Queda un cabo suelto atado a la publicación:** la ruta de la imagen es
relativa y varios rastreadores exigen una URL absoluta. En cuanto haya dominio
hay que cambiarla y añadir `og:url`. Está anotado en el propio `index.html`,
que es donde va a mirar quien lo haga.
