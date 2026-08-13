# Plan visual — que se vea como el juego

Objetivo: que la página deje de parecer una maqueta 3D y se sienta como estar
parado en las Tierras Intermedias. Este documento es el plan largo; el
[PLAN_DE_DESARROLLO](./PLAN_DE_DESARROLLO.md) sigue siendo la lista corta de cada
sesión.

---

## 1. Qué hace que las referencias se vean así

Mirando las capturas del juego, lo que produce el efecto no es el detalle de las
texturas. Es esto, por orden de importancia:

**La profundidad por niebla.** Cada plano está más lavado y más claro que el que
tiene delante. Primer plano casi negro, ruinas medias en gris verdoso, ciudad al
fondo en ocre pálido, cielo blanco dorado. Esa escalera de contraste es la que
hace que el paisaje se sienta enorme. Es lo más barato de imitar y lo que más
suma.

**El contraluz.** Todo está a contraluz del Árbol: los objetos son siluetas con
un filo iluminado. Nada tiene luz frontal. Por eso funciona tan bien con
geometría simple, que es buena noticia para nosotros.

**Los rayos volumétricos.** La luz baja en haces visibles entre las ramas y entre
las torres. Sin esto, la escena se ve "apagada" aunque el resto esté bien.

**El bloom.** El Árbol no es amarillo, es luz. La diferencia entre un amarillo
plano y algo que quema es el bloom.

**El grano y la suciedad.** Las capturas tienen ruido, aberración cromática en los
bordes y viñeta. Una imagen 3D perfectamente limpia se lee como "render"; una con
suciedad se lee como "captura".

**Las partículas en tres profundidades.** Hojas doradas grandes y desenfocadas
cerca, medianas en el plano medio, polvo diminuto al fondo. Es lo que da la
sensación de aire.

**El color.** Verde oliva enfermizo y dorado. No hay azules. El cielo de Elden
Ring es amarillo verdoso, y eso solo se consigue con un grading deliberado.

---

## 2. La decisión de fondo: qué es imagen y qué es geometría

El riesgo grande de meter capturas del juego es el choque de estilos: una imagen
fotorrealista detrás de un árbol hecho de icosaedros hace que el árbol parezca un
juguete. Peor que antes.

La salida es repartir los papeles:

| Capa | Qué es | Por qué |
|---|---|---|
| Cielo y horizonte | imagen | detalle imposible de generar, no compite con nada |
| Ciudad, montañas, ruinas lejanas | imagen recortada | detalle a distancia, se ve poco y suma mucho |
| El Árbol Áureo | **geometría procedural** | es el sujeto, tiene que moverse y reaccionar al scroll |
| Mesetas y terreno cercano | geometría | la cámara pasa entre ellas, una imagen se rompería |
| Niebla, rayos, partículas | geometría + shaders | tienen que existir en el espacio 3D |
| Todo junto | **postprocesado común** | es lo que unifica lo fotográfico con lo procedural |

Ese último punto es la clave técnica del plan: cuando bloom, grano, viñeta y
grading se aplican al conjunto, la imagen y la geometría empiezan a parecer la
misma cosa. Sin eso se ven pegadas.

Y hay que rehacer el Árbol. El de ahora (cinco icosaedros) no sobrevive al lado
de una captura. El de verdad son ramas blancas finísimas, y eso se genera con
recursión, que además queda mejor que cualquier imagen porque se puede animar.

---

## 2.1 HDRI, PBR y modelos GLTF: dónde entra cada cosa

Tres técnicas que suelen nombrarse juntas pero que rinden muy distinto acá.

**Iluminación por entorno (HDRI). Sí, y ya está puesta.** Es la idea de iluminar
con una imagen del cielo en lugar de con focos, y es lo que hace que la luz se
sienta de un lugar y no de un estudio. Pero no hace falta descargar un `.hdr` de
varios megas: `Environment` de drei acepta paneles emisivos (`Lightformer`) y
genera el mapa en la propia escena. Cero peso, control total del color, y se
renderiza una sola vez. Ya está en `World.tsx`: un disco dorado grande arriba (el
Árbol), un panel verdoso de cielo alto y un rebote pardo desde abajo.

Un HDRI de archivo solo compensaría si quisiéramos reflejos reconocibles en
superficies pulidas, y acá casi todo es roca mate a contraluz.

**Texturas PBR. Sí, pero selectivas.** Un set completo (albedo + normal +
roughness + AO a 2K) son entre 2 y 4 MB por material, y en una escena donde la
roca se ve casi negra la mayor parte del tiempo, eso es invertir en píxeles que
nadie va a mirar. Lo que sí rinde: un **normal map** para que la piedra deje de
ser una superficie perfectamente lisa, y variación de `roughness`. Mejor aún, en
muchos casos alcanza con ruido procedural en el shader, que pesa cero.

Prioridad: media. Va en la fase D, y solo en la meseta madre y el tronco, que son
lo que la cámara mira de cerca.

**Modelos GLTF. Sí, y cambian el reparto del plan.** Acá está lo interesante: si
las ruinas y las torres del plano medio son geometría en vez de recortes, la
cámara puede pasar **entre** ellas, tienen paralaje real, reciben la niebla y
recortan los rayos de luz. Eso es bastante más impresionante que una capa plana.

El truco para que salga barato es instanciar: dos o tres modelos CC0 bien
elegidos (un arco gótico, una columna rota, un fragmento de muralla), repetidos
cuarenta veces con rotación y escala variadas, dan una ciudad entera en silueta
por un solo draw call cada uno. Poly Haven y Quaternius tienen material CC0
utilizable; comprimidos con Draco o meshopt, 300-800 KB por modelo.

Cómo cambia el reparto de la sección 2:

| Plano | Plan original | Con GLTF |
|---|---|---|
| Cielo y horizonte | imagen | imagen (sin cambios) |
| Ciudad lejana | imagen recortada | imagen recortada (sin cambios) |
| **Ruinas medias** | imagen recortada | **geometría instanciada** |
| Terreno cercano | geometría | geometría (sin cambios) |

O sea: **una capa de imagen menos que recortar, y la que más ganaba con ser 3D**.
Va en la fase C, en paralelo a los paisajes.

---

## Fase A — Postprocesado y color ✅ hecho

**Lo que cambia:** todo. Es la fase de mayor impacto por hora invertida, y no
depende de conseguir un solo asset.

### Dependencias

```bash
npm i @react-three/postprocessing postprocessing
```

Presupuesto: alrededor de 60-70 KB gzip. Va a su propio chunk en `manualChunks`.

### Cadena de efectos (`src/world/Post.tsx`)

En este orden, que importa:

1. **SelectiveBloom** sobre el Árbol y el núcleo. `intensity` 1.2, `luminanceThreshold`
   0.25, `mipmapBlur`. Con `<Selection>`/`<Select>` para que las rocas no brillen.
2. **GodRays** con un emisor invisible en la copa. Es el efecto que dibuja los
   haces entre las ramas, exactamente como la referencia. `samples` 60,
   `density` 0.95, `decay` 0.93, `weight` 0.5, `exposure` 0.5.
3. **DepthOfField** suave. `focusDistance` atado al capítulo (en el IV, foco corto
   y todo lo demás disuelto). `bokehScale` 2.5. Es el más caro: solo en calidad alta.
4. **ChromaticAberration** mínima, `offset` [0.0005, 0.0005]. Solo se nota si se
   quita.
5. **Vignette** `darkness` 0.5, `offset` 0.35.
6. **Noise** con `blendFunction: SOFT_LIGHT`, opacidad 0.035. El grano.
7. **HueSaturation + BrightnessContrast** para el grading verde oliva, o un **LUT**
   `.cube` si querés control fino (`LUT` de postprocessing lee texturas 3D).

### El cielo tiene que volver adentro del canvas

Hoy el cielo es un degradado CSS y el canvas va con `alpha`. Con postprocesado eso
deja de funcionar: el bloom, el grano y la viñeta se aplicarían solo a la geometría
y el fondo quedaría limpio por debajo, que es justo la costura que queremos evitar.

Cambio: un domo (`sphereGeometry` invertida) con un ShaderMaterial de degradado
vertical, o directamente la imagen del cielo del capítulo. Vuelve `alpha: false`.

### Sistema de calidad

`src/world/quality.ts` con tres niveles:

- **alto**: cadena completa, `dpr` hasta 2
- **medio**: sin DepthOfField, `samples` de GodRays a 30, `dpr` hasta 1.5
- **bajo**: solo Vignette y Noise, `dpr` 1, partículas a la mitad

Detección inicial por `navigator.hardwareConcurrency` y `deviceMemory`, y ajuste en
caliente con `<PerformanceMonitor>` de drei (`onDecline` baja un nivel). En móvil
se arranca en medio.

### Cómo quedó, y lo que costó averiguarlo

Tres cosas que no estaban en el plan y aparecieron al implementarlo:

**El tone mapping tiene que ir al final de la cadena, no en el renderer.** Con
`EffectComposer`, la escena se renderiza en HDR y los valores por encima de 1
sobreviven hasta el volcado final. Sin un paso de tone mapping, no se comprimen:
se recortan. El resultado fue una pantalla blanca. Ahora el renderer va con
`NoToneMapping` y la cadena termina en `ToneMapping` ACES. (Probé AgX primero,
que es más moderno, pero desatura tanto que el dorado se volvía beige.)

**El bloom se comía el cielo.** Con el umbral en 0.5, medio cielo lo superaba y el
efecto lo amplificaba hasta el blanco. Está en 0.92: solo lo cruzan los materiales
emisivos, que es justo lo que tiene que brillar.

**Los rayos necesitan algo que los recorte.** Un emisor completamente tapado no
produce nada, y uno completamente descubierto lava la pantalla entera. Hoy está
apenas asomando por encima de la copa, con valores conservadores. El efecto de
verdad llega con la fase B: las ramas finas del Árbol fractal son exactamente la
rejilla que los rayos necesitan.

### Rendimiento: pendiente de medir en condiciones

El navegador con el que verifico corre por software (SwiftShader, sin GPU): da
6 fps con la cadena completa, así que **no sirve para juzgar el coste real**. Lo
que sí quedó demostrado es que el sistema de calidad funciona: detectó la caída y
bajó solo a `low`.

Hay que medirlo en un equipo con GPU. Con `?q=high`, `?q=medium` y `?q=low` en la
URL se fuerza cada nivel sin tocar código.

### Coste

El bundle pasó de 345 a 405 KB gzip (el postprocesado son 28 KB gz; el resto es la
actualización de three, que subió de 0.171 a 0.185 porque
`@react-three/postprocessing` 3.0.5 la exige).

---

## Fase B — El Árbol de verdad

**Lo que cambia:** el sujeto de la página deja de parecer un brócoli.

### Generación (`src/world/erdtree/branches.ts`)

Un sistema recursivo, no un modelo:

```
rama(origen, dirección, largo, radio, nivel)
  → empuja una Matrix4 al array
  → si nivel < 7: dos o tres hijas con
      largo  × 0.72
      radio  × 0.65
      ángulo 22°-38° respecto de la madre, repartidas alrededor
      + una desviación aleatoria con semilla fija
```

Siete niveles dan entre 2.000 y 4.000 ramas. Todas en **un solo `InstancedMesh`**
con un cilindro de una unidad, así que es **un draw call**. Se genera una vez en un
`useMemo` (unos pocos milisegundos) y nunca más.

El PRNG va con semilla fija (mulberry32, ocho líneas) para que el Árbol sea siempre
el mismo. Cambiar la semilla es cambiar de árbol, y eso queda como perilla en
`story.ts`.

### Materiales

- Ramas: casi blancas (`#f6ecd8`), emisivo bajo, y el emisivo sube hacia las puntas
  con un atributo de instancia por nivel. Con bloom, las puntas queman.
- Hojas: `Points` con la textura de mota dorada, unas 6.000, colocadas en las puntas
  de los dos últimos niveles. Shader propio para el titileo (seno con desfase por
  índice) y para que el tamaño caiga con la distancia.
- El tronco lleva dentro el emisor de los GodRays.

### Animación

- Balanceo por nivel: las ramas finas se mueven más que el tronco. Se hace en el
  shader con un `uTime` y la altura del vértice, no moviendo instancias en la CPU.
- `blaze` (el número que ya existe) apaga el emisivo y las hojas con la Fractura, y
  desprende una tanda de hojas que caen.

### Riesgo

Generar 4.000 matrices bloquea el hilo unos milisegundos en el arranque. Si molesta,
se genera en el preloader, que igual va a estar esperando a las texturas.

---

## Fase C — Los paisajes

**Lo que cambia:** aparece el mundo alrededor.

### Un mundo, no cinco postales

Lo natural sería una imagen por capítulo. No lo recomiendo: son cinco composiciones
distintas que hay que recortar y que además no se sienten como el mismo lugar.

Mejor: **dos escenarios muy trabajados**, y que la cámara los recorra distinto en
cada capítulo.

- **Escenario A — la llanura y la capital.** Sirve para los capítulos I, II, III y V.
  Es la referencia de Leyndell vista desde Necrolimbo.
- **Escenario B — bajo tierra.** Para el capítulo IV: raíces gigantes, agua quieta,
  oscuridad. La cámara ya baja ahí.

### Las capas (`src/world/Backdrop.tsx`)

Cada escenario son planos a distintas Z dentro de la misma escena 3D. El parallax no
se simula: sale de la perspectiva, porque la cámara se mueve de verdad.

| Capa | Z | Con alfa | Notas |
|---|---|---|---|
| Cielo | -120 | no | ocupa todo el encuadre, se mueve poquísimo |
| Montañas / horizonte | -80 | sí | |
| Ciudad y murallas | -55 | sí | acá va Leyndell |
| Ruinas medias | -30 | sí | se cruza con la geometría de las mesetas |
| Vegetación cercana | -8 | sí | por delante del Árbol |
| Primer plano | +6 | sí | rocas y hierba, muy desenfocadas por el DOF |

Cada capa es un `meshBasicMaterial` con `transparent`, `toneMapped: false` y la
niebla activada, para que el aire de la escena las tiña igual que a la geometría.

### Profundidad dentro de la imagen

Dos opciones, y se pueden combinar:

**Recorte plano (seguro).** Cada capa es un plano. Robusto, predecible, funciona
siempre. Es el 80% del efecto.

**Displacement por mapa de profundidad (el que impresiona).** Al cielo y al fondo se
les genera un mapa de profundidad y se subdividen (256×256). El vertex shader empuja
cada vértice según el mapa, así que la imagen tiene volumen real y la cámara puede
entrar en ella. Con el movimiento del puntero se nota muchísimo.

Cuidado con el estirado en los bordes de los objetos: se controla limitando la
fuerza del desplazamiento (2-4 unidades) y con un poco de desenfoque en el mapa.

### Cómo se preparan los assets

Ver la sección 8. Es la parte que depende de vos.

### Carga

`useTexture` de drei dentro de `<Suspense>`, con el preloader de la fase E mostrando
`useProgress`. `<Preload all />` para que no haya tirones al compilar shaders. Las
capas del escenario B se cargan en segundo plano cuando el lector va por el
capítulo III.

---

## Fase D — Atmósfera viva

**Lo que cambia:** el aire.

- **Niebla por capas.** Tres o cuatro planos grandes con textura de ruido, muy
  transparentes, desplazándose lentísimo en direcciones distintas y a distintas Z.
  Es lo que separa los planos y lo que hace que el paisaje respire. `Cloud` de drei
  puede servir de atajo.
- **Niebla exponencial.** Cambiar `fog` lineal por `fogExp2`, que se parece más a la
  atenuación real y no tiene un corte visible.
- **Hojas doradas en tres tamaños.** `InstancedMesh` de planos pequeños con
  `Billboard`, con caída y deriva senoidal, en tres grupos por profundidad. Las del
  primer plano, grandes y desenfocadas por el DOF: eso es lo que se ve en las
  capturas.
- **Rayos falsos complementarios.** Además de los GodRays del postpro, dos o tres
  planos aditivos muy sutiles con textura de haz, girando muy despacio. Los GodRays
  salen del emisor; estos dan volumen lateral.
- **Ceniza en el capítulo III** y **motas que suben en el IV** (bajo tierra la
  gravedad narrativa se invierte: las partículas suben hacia la superficie).
- **Sonido.** Viento en bucle (~150 KB en opus), el latido de las raíces que sube en
  el capítulo IV, y un golpe grave en la Fractura. Web Audio con un `GainNode`
  maestro, botón de silencio persistido en `localStorage`, y arranque solo tras la
  primera interacción (el autoplay está bloqueado y así debe ser).

---

## Fase E — GSAP a fondo

**Lo que cambia:** el ritmo. Esta es la fase que hace que se sienta caro.

Todos los plugins están en el paquete que ya tenemos instalado (desde GSAP 3.13 son
gratuitos): ScrollSmoother, SplitText, MorphSVG, DrawSVG, Flip, Observer,
MotionPath, CustomEase, ScrambleText, Physics2D.

### ScrollSmoother

Inercia real en el scroll. Cambia la sensación de la página entera más que
cualquier otra cosa de esta lista.

Requiere envolver el contenido en `#smooth-wrapper > #smooth-content`. Lo fijo
(canvas, riel, barra de progreso) tiene que quedar **fuera** del wrapper, y ya lo
está. Con `effects: true`, los bloques aceptan `data-speed` y `data-lag`: parallax
por elemento sin escribir una línea.

Riesgo: hay que revisar el mapeo de anclas, porque el scroll pasa a ser virtual.
`ScrollSmoother.scrollTop()` en vez de `window.scrollY`.

### La Fractura, escena pinneada

El momento fuerte. La sección II se pinea 250vh y el progreso del pin conduce una
timeline:

```
0.0  el Anillo entero, quieto, el Árbol a pleno
0.2  una grieta cruza la pantalla (SVG con DrawSVG, 0.4s, ease power4.in)
0.25 golpe: el color se desatura a la mitad, el sonido baja, un frame casi blanco
0.3  los tres arcos salen disparados y se desalinean
0.5  el Árbol pierde la mitad de su luz; caen hojas
0.8  las mesetas terminan de apartarse
1.0  el color vuelve, pero más frío que antes
```

Con `ScrollTrigger.scrub: 1` todo eso ocurre bajo el control del dedo, hacia
adelante y hacia atrás. Es el tipo de momento que la gente rebobina.

Ojo: el pin cambia la altura de la página, así que hay que remedir las anclas de
capítulo en el `onRefresh` (ya se hace) y verificar que el spacer no descoloque el
mapeo.

### Texto

- SplitText por **líneas y palabras** con `mask: 'lines'` y `autoSplit: true`, que
  vuelve a partir cuando cambia el ancho o cargan las fuentes.
- Stagger direccional: el texto del bloque derecho entra desde la derecha.
- ScrambleText en los nombres propios (Marika, Godrick, Radagon) cuando entran:
  las letras se resuelven en su sitio. Sutil, y muy soulslike.
- Los números romanos del riel morfeando con MorphSVG de uno a otro.

### Preloader

Mientras `useProgress` carga texturas: una runa dorada se dibuja sola con DrawSVG
sobre negro. Al llegar al 100%, la runa se expande, un destello blanco dorado cubre
la pantalla y se disuelve para dejar ver el Árbol. Dos segundos, y marca el tono de
todo lo que sigue.

### Mapa final con DrawSVG

En el capítulo V, un mapa de las Tierras Intermedias se dibuja trazo a trazo atado
al scroll, y los cinco puntos de la historia se encienden en orden. Cierra el
recorrido y da una razón para llegar hasta el final.

### Detalles que suman

- **Cursor propio**: un punto dorado con inercia (`quickTo`), que crece sobre lo
  interactivo. Se desactiva en táctil y con movimiento reducido.
- **Flip**: al pulsar el riel, se despliega a un índice a pantalla completa con los
  cinco capítulos y vuelve. Flip hace la transición de layout sola.
- **Observer**: gestos de teclado y rueda para saltar de capítulo con una
  animación propia en vez del scroll nativo.
- **CustomEase**: una curva propia para la cámara, más lenta al principio y con
  frenada larga. Es lo que separa "animado" de "coreografiado".

---

## Fase F — Interacción y remate

- **Puntos calientes.** Tres o cuatro marcas doradas en la escena (la capital, el
  campo de batalla, las raíces). Al pasar el mouse crecen; al pulsar, un panel con
  el lore. Requiere raycasting sobre la geometría, y por eso hay que revisar los
  `pointer-events` del texto (anotado en el plan viejo).
- **Vuelo libre al terminar.** Después del mapa, la cámara se suelta con
  OrbitControls limitados y aparece "recorré lo que quede". Que el visitante juegue
  con el mundo es lo que hace que se quede.
- **og:image real.** Una captura del capítulo I a 1200×630. Ahora que la escena se
  ve bien, vale la pena.
- **Deploy en Vercel** con el dominio que quieras.

---

## 7. Rendimiento, que no es opcional

Con imágenes y postprocesado, esto pasa de pesar nada a pesar de verdad. Presupuesto:

| Concepto | Hoy | Objetivo |
|---|---|---|
| JS (gzip) | 345 KB | < 450 KB |
| Imágenes | 0 | < 3,5 MB, con la primera vista < 1,2 MB |
| Audio | 0 | < 250 KB |
| Primer render útil | inmediato | < 2,5 s en conexión buena |

Medidas:

- `React.lazy` para todo el mundo 3D, con el preloader por delante (esto ya estaba
  en la fase 4 del plan viejo y ahora es obligatorio).
- AVIF con fallback WebP, y `srcset` por densidad: las capas grandes en dos tamaños.
- Cargar el escenario B recién cuando haga falta.
- Tiers de calidad de la fase A.
- Lighthouse por encima de 90 en accesibilidad; en rendimiento, con esta cantidad de
  WebGL, apuntar a 75-85 es honesto.
- Todo lo nuevo respeta `prefers-reduced-motion`: sin ScrollSmoother, sin cursor
  propio, sin partículas, sin god rays animados, texto directo.

---

## 8. Lo que hay que conseguir (assets)

Esta es la parte que no es código.

### Lista mínima

**Escenario A — la llanura y la capital** (6 archivos)

1. `sky-a.avif` — cielo con nubes, 2560×1440, sin alfa
2. `far-a.avif` — montañas del horizonte, con alfa
3. `city-a.avif` — la capital con sus murallas y torres, con alfa
4. `ruins-a.avif` — ruinas del plano medio, con alfa
5. `near-a.avif` — vegetación y rocas cercanas, con alfa
6. `fore-a.avif` — primer plano, rocas grandes, con alfa

**Escenario B — bajo tierra** (4 archivos): fondo de raíces, raíces medias, agua,
primer plano de piedra.

**Mapas de profundidad** (opcional, solo cielo y fondo): grises de 8 bits a mitad de
resolución.

**Texturas sueltas**: mota dorada para las hojas (256×256 con alfa), ruido para la
niebla (512×512, se puede generar con código), haz de luz (512×512).

### Cómo prepararlas

1. **Capturas.** Lo más limpio es que salgan de tu partida, con el modo foto y sin
   HUD. Te da control de la composición, que es más de la mitad del resultado.
2. **Recorte por capas.** Photopea (gratis, en el navegador) o GIMP. Para separar
   siluetas complicadas, la demo de Segment Anything o `rembg` desde la terminal.
3. **Mapas de profundidad.** Depth Anything V2, que tiene Space gratuito en Hugging
   Face: subís la imagen, bajás el mapa.
4. **Compresión.** Squoosh a AVIF con calidad 50-60. Cada capa debería quedar entre
   150 y 400 KB.
5. Todo a `public/scenes/`.

### La alternativa sin capturas

Si preferís no usar material del juego: el mismo pipeline funciona con arte
generado o pintado. Las capas y los mapas de profundidad son iguales. Cambia de
dónde sale el píxel, no la técnica.

Recordá que el aviso de proyecto de fan ya está en el cierre y en el README, y que
el material sigue siendo de FromSoftware y Bandai Namco. Para un sitio personal sin
monetizar es zona gris tolerada, pero es tu decisión y conviene tomarla a
conciencia, no por inercia.

---

## 9. Orden y tamaño

Cada "sesión" es una tanda de trabajo con revisión en el navegador al final.

| # | Fase | Sesiones | Depende de assets |
|---|---|---|---|
| 1 | A — postprocesado y color | 1-2 | no |
| 2 | B — Árbol fractal | 1-2 | no |
| 3 | E1 — ScrollSmoother y preloader | 1 | no |
| 4 | C — paisajes por capas | 2-3 | **sí** |
| 5 | D — atmósfera y partículas | 2 | parcial |
| 6 | E2 — la Fractura pinneada, texto, mapa | 2-3 | no |
| 7 | F — interacción y remate | 1-2 | no |
| 8 | Rendimiento y pulido final | 1-2 | no |

Total: entre once y diecisiete sesiones. Las tres primeras no necesitan que
consigas nada, y ya dejan la página irreconocible.

### Los momentos que la gente va a recordar

Si algo de esto se cae por el camino, que no sean estos cinco:

1. La runa dibujándose en el preloader y el destello que abre el mundo.
2. El Árbol con los rayos bajando entre las ramas y las hojas cayendo.
3. La Fractura pinneada: la grieta, el golpe, el color que se va.
4. El descenso a las raíces, con la luz que se apagó arriba encendida abajo.
5. El mapa que se dibuja solo al final, y la cámara que te sueltan después.
