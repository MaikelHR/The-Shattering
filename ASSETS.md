# Qué capturas hacen falta

Lista de trabajo para las capas de imagen de la fase C. Todo va a
`public/scenes/`, con los nombres exactos de más abajo.

No hace falta que salga todo de una sola partida ni de un solo sitio: cada capa
es independiente y se compone después. Lo único que tiene que ser coherente entre
capas es **la altura del horizonte y la hora del día**.

---

## Antes de empezar

- **HUD apagado.** Ajustes → Pantalla → mostrar HUD en off, o el modo foto.
- **Sin personaje ni montura en cuadro**, o en una esquina fácil de recortar.
- **Cámara horizontal**, sin inclinar arriba ni abajo. Si inclinás, las verticales
  se abren y las capas dejan de encajar entre sí.
- **La misma hora del día en todas**: mañana con niebla es lo que más se parece a
  tus referencias. Nada de noche.
- **La resolución más alta que te dé el equipo.** Sobra resolución, no falta:
  siempre se puede bajar.
- Formato de captura: PNG o el que use tu sistema. La compresión viene después.

---

## Escenario A — la llanura y la capital

Sirve para los capítulos I, II, III y V. La referencia es el mirador de Necrolimbo
mirando hacia Leyndell.

| Archivo | Qué tiene que verse | Notas |
|---|---|---|
| `a-sky.avif` | solo cielo y nubes, sin suelo | mirá al horizonte desde un descampado; después se recorta la franja de abajo |
| `a-far.avif` | montañas y acantilados del fondo | cuanto más lavado por la niebla, mejor |
| `a-city.avif` | la capital: murallas, torres, puentes | es la capa protagonista, buscá la silueta más rica |
| `a-ruins.avif` | arcos, columnas y muros rotos sueltos | tres o cuatro capturas de ruinas distintas vienen bien |
| `a-near.avif` | árboles secos y matorrales cercanos | van por delante del Árbol, en silueta |
| `a-fore.avif` | rocas grandes de primer plano | van desenfocadas, no importa el detalle |

## Escenario B — bajo tierra

Para el capítulo IV. Las Profundidades de las Raíces, o cualquier zona subterránea
con raíces gigantes y agua quieta.

| Archivo | Qué tiene que verse |
|---|---|
| `b-far.avif` | el fondo de la caverna, con luz al final |
| `b-roots.avif` | raíces grandes cruzando el encuadre |
| `b-water.avif` | la superficie del agua, plana |
| `b-fore.avif` | piedra de primer plano |

---

## Cómo recortar cada capa

1. Abrí la captura en **Photopea** (photopea.com, gratis, funciona igual que
   Photoshop y no hay que instalar nada).
2. Seleccioná lo que quede en esa capa y borrá el resto. Para siluetas
   complicadas: `Selección → Objeto`, o la demo de **Segment Anything**.
3. Guardá como PNG con transparencia.
4. Comprimí en **Squoosh** (squoosh.app) a **AVIF, calidad 50-60**. Cada capa
   debería quedar entre 150 y 400 KB. Si alguna se pasa de 500 KB, bajá la
   calidad antes que la resolución.
5. Ancho objetivo: **2560 px** para el cielo y la ciudad, **2048 px** para el
   resto. La altura, la que salga.

**Los bordes importan.** Un recorte con halo blanco alrededor se nota muchísimo
cuando la capa está a contraluz. Si la selección deja borde, achicá un píxel el
contorno antes de borrar.

---

## Opcional: mapas de profundidad

Solo para `a-sky`, `a-far` y `a-city`. Le dan volumen real a la imagen: el shader
empuja los vértices según el gris del mapa y la cámara puede moverse dentro de la
foto.

1. Subí la imagen a **Depth Anything V2** en Hugging Face Spaces (gratis).
2. Descargá el mapa en gris.
3. Guardalo a **la mitad de la resolución** del original, como WebP.
4. Nombre: el de la capa más `.depth`, por ejemplo `a-city.depth.webp`.

Si esto se hace cuesta arriba, se puede saltar: las capas planas ya dan la mayor
parte del efecto.

---

## Cuando estén listas

Dejalas en `public/scenes/` y avisame. Yo me encargo del componente que las
coloca en el espacio 3D, de los shaders y de que la niebla y el postprocesado las
traten igual que a la geometría, para que no se noten pegadas.

Si preferís empezar por poco: con `a-sky`, `a-far` y `a-city` ya se puede montar
el escenario A y ver cómo queda antes de recortar el resto.
