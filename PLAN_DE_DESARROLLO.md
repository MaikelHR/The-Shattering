# Plan de desarrollo — Tierras Intermedias

Documento vivo. Una casilla por sesión, un commit por cada cosa que funcione.

Para el salto visual grande (postprocesado, Árbol fractal, paisajes por capas,
GSAP a fondo) hay un plan aparte: **[PLAN_VISUAL.md](./PLAN_VISUAL.md)**. Las
fases 1 a 5 de acá abajo quedan subordinadas a ese, que las absorbe casi todas.

---

## 0.2 Elden Ring — 12 de agosto de 2026

El proyecto nació como *Aureth*, un reino inventado de islas flotantes. Ahora
cuenta la caída de la Orden Áurea. El motor es el mismo: cambió la historia, la
paleta y lo que hay en la escena, no la arquitectura.

- [x] Historia nueva en `story.ts`: la Orden, la Fractura, los Semidioses, las
      raíces, el Sinluz
- [x] Paleta de oro y ámbar sobre bruma parda, y el cielo pasa a ser un degradado
      CSS con el canvas en `alpha`
- [x] El Árbol Áureo (`Erdtree.tsx`): tronco, copa facetada, luz y halo de sprite
- [x] El Anillo de Elden (`BrokenRing.tsx`): tres arcos que la Fractura aparta
- [x] Las islas pasan a ser mesetas; el núcleo, las raíces bajo la capital
- [x] La luz cuenta el arco: el Árbol se apaga con la Fractura y esa misma luz
      aparece abajo, en las raíces, en el capítulo IV
- [x] La cámara se sincroniza con las secciones reales y no con el progreso total
      (antes nunca llegaba al encuadre del capítulo que estabas leyendo)
- [x] Los umbrales de la escena se declaran en capítulos, no en porcentajes
- [x] El encuadre se adapta a pantallas verticales: sujeto centrado, mirada más
      alta, cámara más lejos, y el texto al pie
- [x] Aviso de proyecto de fan en el cierre

Sin un solo asset descargado: el peso de la página no cambió.

---

## 0. Estado actual

- [x] Puente GSAP ⇄ Three.js sin re-renders de React (`scrollState.ts`)
- [x] ScrollTrigger maestro que reporta progreso y capítulo
- [x] Cámara interpolada entre capítulos, con suavizado independiente del framerate
- [x] Mesetas flotantes que derivan y se separan según el avance de la historia
- [x] Una luz que late abajo y se enciende en el capítulo IV
- [x] Revelados de texto con SplitText (`mask`) y parallax con `scrub`
- [x] Riel de capítulos, barra de progreso
- [x] `prefers-reduced-motion` respetado en todo
- [x] Responsive básico y meta tags Open Graph

## 0.1 Correcciones — 12 de agosto de 2026 (todavía como Aureth)

Primera pasada por el navegador. La versión inicial nunca se había corrido, y
varias cosas no hacían lo que decía el código.

- [x] SplitText partía los cinco títulos desde cada capítulo (no respeta el `scope`
      de `useGSAP`): los títulos quedaban invisibles hasta llegar al capítulo V
- [x] Al recargar a mitad de página la cámara arrancaba en el capítulo I y volaba
      hasta donde estabas: faltaba escribir el estado en `onRefresh` y plantar la
      cámara en el primer frame
- [x] `chapter` se calculaba con `round` y `chapterProgress` con `floor`: hablaban
      de capítulos distintos
- [x] `velocity` se quedaba congelada con el último valor al soltar el scroll.
      Ahora decae sola y mueve un poco el FOV cuando bajás rápido
- [x] El riel se quedaba marcando un capítulo viejo al saltar el scroll de golpe
      (`onToggle` no dispara en los saltos; `onEnter`/`onEnterBack` sí)
- [x] ScrollTrigger medía con la fuente de sistema y no volvía a medir cuando
      llegaban las de Google: los capítulos disparaban corridos
- [x] El "borde iluminado" de las islas era una tapa entera de jade emisivo, no un
      borde: se veía la meseta plana y verde en vez de roca con un filo de luz
- [x] El riel se metía debajo del bloque de texto (ahora el margen izquierdo le
      reserva un canal)
- [x] La alternancia izquierda/derecha se contaba con `:nth-child(even)` incluyendo
      el hero, así que iba corrida. Ahora es un `data-align` explícito
- [x] `100vh` saltaba con la barra de URL en móvil (`svh`, y `ignoreMobileResize`)
- [x] El texto no se podía seleccionar (`pointer-events: none`), y arreglarlo dejaba
      sin deriva a la cámara: el canvas ahora escucha en `document.body`
- [x] El riel era un `<nav>` de elementos inertes: ahora son botones que llevan al
      capítulo, con `aria-current` y foco visible
- [x] Movimiento reducido de verdad en el mundo 3D (antes las islas, el núcleo y las
      estrellas se movían igual)
- [x] Limpieza: `castShadow` sin sombras en el canvas, un `useMemo` sobre una
      constante, siete `useFrame` haciendo la misma cuenta
- [x] Favicon (era un 404 en cada carga), `theme-color`, `noscript`
- [x] `three`, `r3f` y `gsap` en chunks aparte, y tsconfig más estricto

---

## Fase 1 — Pulido del movimiento

Acá se aprende el oficio de la animación: el ritmo.

- [ ] Ajustar tiempos y `ease` de cada capítulo hasta que respire bien
- [ ] Probar `ScrollSmoother` de GSAP (scroll con inercia) y decidir si suma o marea
- [ ] Transiciones de niebla/color entre capítulos (la paleta cambia al descender).
      Ahora que el mundo lee `position`, se puede animar el degradado del cielo
      por capítulo y no por porcentaje de scroll
- [ ] `MorphSVG` para un símbolo que se transforma capítulo a capítulo
- [x] Micro-interacciones al pasar el mouse sobre el riel

## Fase 2 — Profundidad del mundo

- [ ] Postprocesado: bloom de verdad en el Árbol y en las raíces, viñeta
- [ ] Partículas que caen desde las mesetas rotas
- [ ] Un elemento que el usuario pueda tocar (una meseta que reacciona al clic).
      Ojo: los bloques de texto ahora reciben eventos, así que habrá que dejar pasar
      el clic hacia el canvas donde haga falta
- [ ] Niebla volumétrica o capas de plano con textura para dar más profundidad
- [ ] Modelo GLTF real (una torre de Leyndell, un puente roto) en vez de solo
      primitivas
- [ ] Si se quieren imágenes del juego: como texturas en planos dentro de la
      escena, no como fondos CSS. El parallax sale del 3D y el puente GSAP ⇄ R3F
      sigue siendo el corazón del proyecto. Con mapa de profundidad, además, se
      pueden desplazar en el shader

## Fase 3 — Narrativa

- [ ] Más capítulos, o ramas: dos recorridos distintos según una elección
- [ ] Sonido ambiental con Web Audio (viento, el latido de las raíces) con botón de mute
- [ ] Un mapa final que se dibuja solo con `DrawSVG`
- [ ] Textos que aparecen en el mundo 3D, no solo en HTML (`Text` de drei)

## Fase 4 — Rendimiento y calidad

El bundle son 1,19 MB (345 KB con gzip), casi todo Three.js. Ya está partido en
chunks para que la caché no se invalide entera, pero se sigue descargando todo
junto al entrar.

- [ ] Code splitting: cargar el mundo 3D con `React.lazy` + Suspense
- [ ] Pantalla de carga real con `useProgress` de drei
- [ ] Bajar calidad automáticamente en equipos lentos (medir fps y ajustar `dpr`)
- [ ] Revisar en móvil de gama baja y en Safari
- [ ] Auditoría de Lighthouse (rendimiento y accesibilidad)

## Fase 5 — Publicar

- [ ] Deploy en Vercel
- [ ] Imagen `og:image` real para que el link se comparta bien (hoy no hay ninguna,
      y por eso el twitter:card es `summary` y no `summary_large_image`)
- [ ] Grabar un video corto del recorrido para el portafolio
- [ ] Escribir un post explicando el puente GSAP ⇄ R3F (es el tipo de artículo
      que la gente comparte, y demuestra que entendiste el problema)

---

## Ideas sueltas

- Modo "vuelo libre" al terminar la historia: soltar la cámara con OrbitControls
- Un contador de profundidad que baja mientras descendés
- Versión en inglés con un selector de idioma
- Cambiar la hora del día del mundo según la hora real del visitante
