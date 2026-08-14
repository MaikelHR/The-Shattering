# Plan — lo que falta

Este archivo es **lo que queda por hacer, en orden**. Lo hecho, con lo que costó
averiguarlo, está en **[BITACORA.md](./BITACORA.md)**.

Antes había dos planes, uno «de desarrollo» y otro «visual», y se solapaban en
un setenta por ciento: la misma casilla aparecía en los dos, con distinto nombre
y a veces con distinto estado. Peor todavía, varias hablaban de cosas que ya no
existen —las mesetas flotantes, las capas de imagen— porque el proyecto cambió
de rumbo y los documentos no. Ahora hay uno.

---

## El norte

Lo que hace que las referencias del juego se vean así no es el detalle de las
texturas. Por orden de importancia:

1. **La profundidad por niebla.** Cada plano más lavado que el de delante. Esa
   escalera de contraste es la que hace que el paisaje se sienta enorme.
2. **El contraluz.** Todo a contraluz del Árbol: siluetas con un filo iluminado.
   Nada con luz frontal. Por eso funciona con geometría simple.
3. **Los rayos volumétricos.** La luz bajando en haces entre las ramas.
4. **El bloom.** El Árbol no es amarillo, es luz.
5. **El grano y la suciedad.** Una imagen limpia se lee como «render»; una con
   ruido, aberración y viñeta se lee como «captura».
6. **Las partículas en tres profundidades.** Es lo que da sensación de aire.
7. **El color.** Verde oliva enfermizo y dorado. No hay azules.

**Techo honesto:** las referencias son un motor AAA con iluminación horneada. En
el navegador se llega lejos, pero no ahí. Lo que sí está a nuestro alcance:
siluetas creíbles, peso, materia, aire y una capa fotográfica encima. Con esas
cinco, la escena deja de leerse como maqueta aunque no sea fotorrealista.

---

## Dónde estamos

| | Estado |
|---|---|
| Postprocesado y color | ✅ |
| El Árbol generado por recursión | ✅ |
| Terreno continuo, hierba, piedras, ruinas | ✅ |
| Nueve capítulos y el recorrido de cámara | ✅ |
| Los cambios de color del mundo (podredumbre, incendio) | ✅ |
| La entrada: runa, destello y carga diferida | ✅ |
| El mundo alrededor: la capital, el cielo | ⏳ replanteado, ver abajo |
| Atmósfera viva: hojas, ceniza, sonido | ⏳ |
| GSAP a fondo: la entrada, la Fractura, el texto | ⏳ |
| Interacción y publicación | ⏳ |

De **los cinco momentos que la gente iba a recordar**, va uno hecho y otro a
medias:

| | |
|---|---|
| La runa dibujándose en la entrada y el destello que abre el mundo | ✅ |
| El Árbol con los rayos entre las ramas y las hojas cayendo | ½ (los rayos existen pero flojos; no hay hojas) |
| La Fractura pinneada: la grieta, el golpe, el color que se va | ⏳ |
| El descenso a las raíces, con la luz encendida abajo | ✅ |
| El mapa que se dibuja solo al final, y la cámara que te sueltan | ⏳ |

---

## Los paisajes por capas se retiran (y qué los reemplaza)

El plan viejo tenía una fase entera —la C— para montar el mundo lejano con
**capturas del juego recortadas** en planos a distintas Z: cielo, montañas,
ciudad, ruinas medias. Y un pliego de trabajo para que sacaras esas capturas.

Esa fase murió sola, por una decisión que tomamos después: *no quiero casi
formas geométricas, la gracia del realismo es que se vea realista*. De ahí
salieron el terreno continuo, la cordillera, las ruinas de piedra y la ciudad
que flota, todo geometría. **Poner planos con fotos detrás de eso sería ir hacia
atrás**: una capa plana no tiene paralaje propio, no recorta los rayos de luz,
no proyecta ni recibe sombra, y a poco que la cámara se mueva se delata. Además
choca de estilo, que era el riesgo que el propio plan señalaba en su primera
página.

Pero los dos huecos que la fase C venía a tapar siguen ahí:

- **La capital no está.** Hay ruinas en el suelo, pero no hay Leyndell en el
  horizonte, y es el hito que más dice «imperio» de toda la referencia.
- **El cielo es un degradado.** Bonito, pero sin nubes.

Los dos se resuelven con lo que ya sabemos hacer, y por eso bajan de fase entera
a dos tareas concretas (ver el paso 3). El pliego de capturas (`ASSETS.md`) se
borra: pedía trabajo tuyo para algo que ya no vamos a montar así.

---

## Lo que viene, en orden

El criterio del orden: **primero lo que no depende de conseguir nada**, y dentro
de eso, lo que arregla un número medido antes que lo que añade.

### 1 · La entrada — preloader, carga diferida y ScrollSmoother

Las tres tocan lo mismo (cómo carga la página y cómo se mide el scroll), así que
van juntas o hay que verificar dos veces.

- [x] **`React.lazy` para todo el mundo 3D.** Lo que bloquea el primer pintado
      pasa de 549 a **118 KB gzip**, y el primer pintado a 84 ms. El total no
      baja —los bytes son los mismos—, pero el texto ya no espera al motor.
- [x] **El preloader.** Una runa dorada —el Anillo partido con el Árbol
      dentro— que se dibuja sola con DrawSVG sobre negro, y un destello que
      abre el mundo. El primero de los cinco momentos.
- [ ] **ScrollSmoother**, y decidir con honestidad si suma o marea. Cambia la
      sensación de la página entera más que cualquier otra cosa de la lista.
      Requiere `#smooth-wrapper > #smooth-content`, con lo fijo (canvas, riel,
      barra) **fuera** del wrapper, que ya lo está.
      **Riesgo real:** el scroll pasa a ser virtual, y las dieciocho anclas de
      estación se miden hoy con `offsetTop` y `window.scrollY`. Hay que pasarlo
      a `ScrollSmoother.scrollTop()` y volver a comprobar que la cámara llega al
      encuadre del capítulo que se está leyendo, que es la pieza que sostiene
      todo lo demás.

### 2 · La Fractura pinneada

El momento fuerte, y el que más se echa de menos. La sección del capítulo II se
pinea 250vh y el progreso del pin conduce una timeline:

```
0.0  el Anillo entero, quieto, el Árbol a pleno
0.2  una grieta cruza la pantalla (SVG con DrawSVG, ease power4.in)
0.25 golpe: el color se desatura a la mitad y un frame casi blanco
0.3  los tres arcos salen disparados y se desalinean
0.5  caen hojas del Árbol
1.0  el color vuelve, pero más frío que antes
```

Con `scrub: 1` todo eso ocurre bajo el control del dedo, hacia adelante y hacia
atrás. Es el tipo de momento que la gente rebobina.

- [ ] La timeline pinneada
- [ ] La grieta en SVG con DrawSVG
- [ ] Remedir las anclas: el pin cambia la altura de la página, y el `onRefresh`
      que ya existe tiene que seguir dando lo mismo con el spacer en medio

### 3 · El mundo alrededor

Lo que la fase C venía a tapar, hecho con geometría.

- [ ] **La capital en el horizonte.** Leyndell en silueta, al norte, entre la
      llanura y el Árbol. Se monta con la técnica que ya está probada en
      `Azula.tsx`: piezas de `ruins/pieces.ts` instanciadas en un grupo, con
      murallas y torres. A esa distancia lo único que llega es la silueta, así
      que no necesita ni texturas ni detalle.
- [ ] **Nubes en el cielo.** En el shader del domo, no como imagen: ruido
      fractal con parallax por altura. Cuesta cero de descarga y se puede teñir
      con la podredumbre y el incendio como ya hace todo lo demás.
- [ ] **Niebla exponencial** (`fogExp2`) en vez de lineal: se parece más a la
      atenuación real y no tiene un corte visible al fondo.

### 4 · Atmósfera viva

- [ ] **Hojas doradas en tres tamaños.** Instanciadas con `Billboard`, con caída
      y deriva senoidal, en tres grupos por profundidad. Las del primer plano
      grandes y desenfocadas por el DOF: eso es lo que se ve en las capturas.
- [ ] **Los respiros, coreografiados.** Hay nueve estaciones sin texto que hoy
      solo viajan. Son el sitio natural para lo que no cabe en un capítulo: la
      ceniza cayendo después de Caelid, las motas que suben saliendo del
      barranco, la grieta. Ninguno de los dos planes viejos las contemplaba
      porque son más nuevas que ellos.
- [ ] **Los rayos, en serio.** Ahora que hay ramas finas de verdad, meter el
      emisor dentro de la copa y subir el peso del efecto. Es la mitad que falta
      del segundo momento.
- [ ] **Sonido.** Viento en bucle (~150 KB en opus), el latido de las raíces que
      sube en el capítulo V, y un golpe grave en la Fractura. Web Audio con un
      `GainNode` maestro, botón de silencio persistido en `localStorage`, y
      arranque solo tras la primera interacción.

### 5 · El texto y el remate

- [ ] **SplitText por líneas** con `autoSplit`, que vuelve a partir cuando cambia
      el ancho o cargan las fuentes. Hoy parte por palabras y no se re-parte.
- [ ] **Stagger direccional**: el texto del bloque derecho entra desde la derecha.
- [ ] **ScrambleText en los nombres propios** (Marika, Godrick, Radahn, Miquella)
      cuando entran. Sutil, y muy soulslike.
- [ ] **CustomEase para la cámara**: una curva propia, más lenta al principio y
      con frenada larga. Es lo que separa «animado» de «coreografiado».
- [ ] **El mapa final con DrawSVG.** Un mapa de las Tierras Intermedias que se
      dibuja trazo a trazo atado al scroll, con los nueve puntos encendiéndose en
      orden. Cierra el recorrido y da una razón para llegar al final.
- [ ] **Vuelo libre.** Después del mapa, la cámara se suelta con OrbitControls
      limitados. Que el visitante juegue con el mundo es lo que hace que se quede.
- [ ] **Puntos calientes**: tres o cuatro marcas doradas en la escena que al
      pulsarlas abren un panel con el lore. Requiere raycasting, y por eso hay
      que dejar pasar el clic hacia el canvas donde haga falta.

### 6 · Publicar

- [ ] **Móvil de verdad.** Es la superficie menos probada. Ya salieron dos fallos
      graves de mirarla una vez (ver BITACORA 0.5), así que conviene mirarla
      entera: las dieciocho estaciones, en un teléfono real y no solo
      redimensionando la ventana.
- [ ] **Safari**, que es donde WebGL se comporta distinto.
- [ ] **`og:image`.** Una captura del capítulo VIII a 1200×630, que es la imagen
      más fuerte que tenemos. Hasta que exista, el `twitter:card` sigue en
      `summary`.
- [ ] **Lighthouse**: por encima de 90 en accesibilidad; en rendimiento, con esta
      cantidad de WebGL, apuntar a 75-85 es honesto.
- [ ] **Deploy en Vercel.**
- [ ] Un vídeo corto del recorrido para el portafolio.
- [ ] Un post explicando el puente GSAP ⇄ R3F. Es el tipo de artículo que la
      gente comparte, y demuestra que entendiste el problema.

---

## Lo que no se va a hacer, y por qué

Vale tanto como la lista de arriba: son decisiones tomadas, no olvidos.

- **Capas de imagen con capturas del juego.** Ver más arriba. Si algún día se
  quieren imágenes, van como textura sobre geometría dentro de la escena, nunca
  como fondo plano.
- **Modelos GLTF descargados.** Se contemplaban para las ruinas y las torres, y
  al final salieron generadas y quedaron mejor: se controlan por parámetros, no
  pesan nada y comparten material con todo lo demás. Un GLTF solo compensaría
  para una forma que no sepamos generar.
- **HDRI de archivo.** El entorno se ilumina con paneles emisivos
  (`Lightformer`), que es la misma idea sin descargar varios megas. Un `.hdr`
  solo compensaría para reflejos reconocibles en superficies pulidas, y acá casi
  todo es roca mate a contraluz.
- **Ramas narrativas** (dos recorridos según una elección). Duplica el trabajo de
  todo lo demás para que cada visitante vea la mitad.
- **Texturas PBR en todo.** Solo donde la cámara mira de cerca. Un set completo
  son 2-4 MB por material, y aquí la roca se ve casi negra la mayor parte del
  tiempo.

---

## Presupuesto

| Concepto | Al empezar | Hoy | Objetivo |
|---|---|---|---|
| **JS que bloquea el primer pintado** (gzip) | 345 KB | **118 KB** | < 200 KB |
| JS total (gzip) | 345 KB | 549 KB | — |
| Primer pintado | — | 84 ms (local) | < 2,5 s en conexión buena |
| Imágenes | 0 | 965 KB (dos texturas de roca) | < 1,5 MB |
| Audio | 0 | 0 | < 250 KB |
| fps | — | 180 (Radeon RX 7600) | > 60 |
| Alto de la página | — | 16,6 pantallas | — |

El presupuesto pasa a medir **lo que bloquea el primer pintado**, que es lo que
de verdad se nota, y no el total. Antes eran lo mismo porque todo llegaba junto;
desde la carga diferida, el motor 3D (431 KB gzip entre three, r3f y el
postprocesado) baja por detrás mientras la runa se dibuja. Quitar efectos para
bajar el total sería pagar calidad por un número que ya nadie espera.

Todo lo nuevo respeta `prefers-reduced-motion`: sin ScrollSmoother, sin
partículas, sin cursor propio, texto directo.

---

## Ideas sueltas

Sin compromiso ninguno.

- Un contador de profundidad que baja mientras descendés
- Versión en inglés con un selector de idioma
- Cambiar la hora del día del mundo según la hora real del visitante
- Un índice a pantalla completa con Flip al pulsar el riel
- Los números romanos del riel morfeando con MorphSVG
- Cursor propio: un punto dorado con inercia (`quickTo`)
