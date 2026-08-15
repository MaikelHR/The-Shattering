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
| La Fractura, clavada en pantalla | ✅ |
| El mundo alrededor: la capital, el cielo | ✅ |
| Atmósfera viva: hojas, ceniza, sonido | ✅ |
| GSAP a fondo: la entrada, la Fractura, el texto | ✅ |
| El remate: el mapa final y el vuelo libre | ✅ |
| Puntos calientes con el lore | ⏳ |
| Publicar | ⏳ |

**Los cinco momentos que la gente iba a recordar están todos hechos:**

| | |
|---|---|
| La runa dibujándose en la entrada y el destello que abre el mundo | ✅ |
| El Árbol con los rayos entre las ramas y las hojas cayendo | ✅ |
| La Fractura pinneada: la grieta, el golpe, el color que se va | ✅ |
| El descenso a las raíces, con la luz encendida abajo | ✅ |
| El mapa que se dibuja solo al final, y la cámara que te sueltan | ✅ |

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
- [x] **ScrollSmoother** puesto, con `smooth: 0.8` y sin suavizado en táctil.
      El riesgo que se temía —que el mundo se desincronizara del texto— no se
      dio: ScrollTrigger lee la posición **suavizada** y no la real, así que el
      puente sigue entregando lo que el lector ve. Comprobado: capítulo
      centrado a 0 px de desfase, riel correcto, salto desde el riel exacto,
      181 fps.
      **Queda una decisión que no es técnica:** si la inercia suma o marea.
      Volver a `smooth: 0.5` la hace casi imperceptible, y quitar la línea la
      desactiva entera.

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

- [x] La timeline pinneada, con `scrub`
- [x] La grieta en SVG con DrawSVG, y el destello
- [x] Las anclas cuentan con el espaciador del pin. Comprobado: las nueve
      secciones con texto siguen centrándose a 0 px, el riel acierta y los
      revelados disparan. 181 fps.

### 3 · El mundo alrededor

Lo que la fase C venía a tapar, hecho con geometría.

- [x] **La capital en el horizonte.** Leyndell en silueta a cien unidades, con
      la técnica ya probada en `Azula.tsx`. No es decoración: es lo que hace que
      el Árbol se vea enorme, porque llena el hueco que había entre las ruinas
      de cerca y las montañas de lejos.
- [x] **Nubes en el cielo**, en el shader del domo: ruido fractal proyectado
      sobre un plano horizontal, así que se aplastan hacia el horizonte solas.
      Se tiñen con la podredumbre y el incendio sin un uniform aparte, porque
      su color sale del propio cielo.
- [x] **Niebla exponencial** (`fogExp2`) en vez de lineal.

### 4 · Atmósfera viva

- [x] **Hojas doradas en tres tamaños**, en `Leaves.tsx`. Envuelven a la cámara
      con un `mod` en el shader, así que el campo es infinito costando
      novecientas hojas y cada una se queda donde está mientras la cámara pasa.
- [x] **Los respiros, coreografiados.** El aire cambia con la historia: ceniza
      saliendo de Caelid, y en el barranco las motas **suben**, que es la única
      vez en toda la crónica que algo va hacia arriba. Lo deciden dos funciones
      nuevas de `mood.ts`, como todo lo demás.
- [x] **Los rayos, en serio.** Emisor más gordo y el efecto con más peso: los
      valores de antes eran de cuando el Árbol era cinco bultos y no había nada
      que recortara los haces.
- [x] **Sonido**, y **sintetizado**: viento de ruido rosa filtrado, el zumbido
      de las raíces en dos senos desafinados y un barrido grave en la Fractura.
      Cero kilobytes contra los ciento cincuenta que costaría un bucle en opus.
      Arranca apagado siempre.

### 5 · El texto

- [x] **SplitText por líneas** con `autoSplit`. Una línea es una unidad de
      lectura; una palabra suelta no significa nada. Y se vuelve a partir
      cuando cambia el ancho o cargan las fuentes.
- [x] **Entrada direccional**: el texto entra por el lado en el que vive el
      bloque. Uno a la derecha que entrara desde la izquierda cruzaría la
      pantalla entera para llegar a su sitio.
- [x] **ScrambleText en los nombres** de los semidioses y su madre, y en nada
      más: si se revuelve todo, revolver no dice nada.
- [x] **CustomEase para la cámara.** Medida: el salto de velocidad al cruzar
      una estación baja de 51 a 27 unidades. Los codos del recorrido llegan a
      159 grados y en recto se tomaban a toda velocidad.

### 6 · El remate

- [x] **El mapa final con DrawSVG**, y en las coordenadas del mundo 3D: el
      Árbol al norte, la capital a sus pies con la misma curva de muralla que
      en la escena, el barranco a cuarenta y siete del centro. No es una
      ilustración parecida al mundo, es el mundo visto desde arriba. Los nueve
      puntos se encienden **cuando el trazo los alcanza**, no a intervalos
      iguales: los tramos miden cosas muy distintas.
- [x] **Vuelo libre**, con el punto de giro puesto donde el Árbol entra en el
      cuadro —a cuarenta de altura y setenta al norte— y no en el centro de la
      llanura, que deja la copa fuera por arriba. El techo del ángulo polar se
      recalcula en cada frame: es el ángulo al que la cámara toca el suelo, y
      depende de lo lejos que esté.
- [ ] **Puntos calientes**: tres o cuatro marcas doradas en la escena que al
      pulsarlas abren un panel con el lore. Requiere raycasting, y por eso hay
      que dejar pasar el clic hacia el canvas donde haga falta.

### 7 · Publicar

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
| **JS que bloquea el primer pintado** (gzip) | 345 KB | **138 KB** | < 200 KB |
| JS total (gzip) | 345 KB | 583 KB | — |
| Primer pintado | — | 84 ms (local) | < 2,5 s en conexión buena |
| Imágenes | 0 | 965 KB (dos texturas de roca) | < 1,5 MB |
| Audio | 0 | **0** (sintetizado) | < 250 KB |
| fps | — | 180 (Radeon RX 7600) | > 60 |
| Alto de la página | — | 21,6 pantallas | — |

El presupuesto pasa a medir **lo que bloquea el primer pintado**, que es lo que
de verdad se nota, y no el total. Antes eran lo mismo porque todo llegaba junto;
desde la carga diferida, el motor 3D (428 KB gzip entre three, r3f y el
postprocesado) baja por detrás mientras la runa se dibuja. Quitar efectos para
bajar el total sería pagar calidad por un número que ya nadie espera.

Los ocho kilobytes que subió el primer pintado son ScrambleText y CustomEase:
caen en el trozo de GSAP, y ese lo carga la entrada aunque la cámara sea lo
único que use la curva. Separarlos ahorraría dos kilobytes a cambio de una
petición más, que no compensa.

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
