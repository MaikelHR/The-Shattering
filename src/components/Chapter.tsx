import { Fragment, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { NOMBRES, type Chapter as ChapterData } from '../story';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

/**
 * Los nombres propios, envueltos para poder revolverlos.
 *
 * `split` con un grupo de captura devuelve el texto y los aciertos
 * intercalados —texto, nombre, texto, nombre...—, así que los índices impares
 * son siempre los nombres. Sale más corto que recorrer la cadena a mano, y
 * sobre todo no obliga a tocar `story.ts`: el contenido sigue siendo texto
 * plano y no un formato con marcas que haya que aprender para escribir.
 *
 * Cada nombre va DOS VECES, y no es un descuido. Mientras dura el revuelto el
 * texto del documento dice «Godkifw», y eso es lo que anunciaría un lector de
 * pantalla si le toca leer el párrafo en ese segundo. Así que el que se
 * revuelve se marca `aria-hidden` y al lado queda una copia quieta que solo
 * existe para quien escucha. El precio es que copiar el párrafo con el ratón
 * duplica el nombre; es el que se paga siempre con esta técnica, y es más
 * barato que anunciar una palabra que no existe.
 */
const RE_NOMBRES = new RegExp(`\\b(${NOMBRES.join('|')})\\b`, 'g');

function conNombres(texto: string) {
  return texto.split(RE_NOMBRES).map((parte, i) =>
    i % 2 ? (
      <Fragment key={i}>
        <span className="solo-lectores">{parte}</span>
        <span className="chapter__nombre" aria-hidden="true">
          {parte}
        </span>
      </Fragment>
    ) : (
      parte
    ),
  );
}

interface ChapterProps {
  /** Si falta, la sección es un respiro: ocupa scroll y no muestra nada. */
  chapter?: ChapterData;
  index: number;
  /** De qué lado va el bloque de texto. Lo decide `ALIGN` en story.ts. */
  align?: 'left' | 'right';
  /**
   * Permiso de App para crear los disparadores. No es un capricho: el scroll
   * suavizado cambia el `scroller` por defecto de ScrollTrigger al crearse, y
   * React ejecuta los efectos de los hijos antes que los del padre. Sin este
   * freno, cada capítulo registraría su disparador contra la ventana y se
   * dispararía en el sitio equivocado.
   */
  armed: boolean;
  reduced: boolean;
}

/**
 * Una estación de la historia.
 *
 * El texto entra en tres tiempos —etiqueta, título línea a línea, párrafos— y
 * el bloque hace parallax mientras pasa. Tres cosas que no son obvias:
 *
 *  - **Se parte por LÍNEAS, no por palabras**, y con `autoSplit`. Una línea es
 *    una unidad de lectura; una palabra suelta no significa nada. Y las líneas
 *    dependen del ancho y de la fuente, así que hay que volver a partirlas
 *    cuando cambia cualquiera de las dos.
 *  - **Todo se resuelve a elementos antes de empezar.** `onSplit` vuelve a
 *    correr en cada re-partición, y esas pasadas ocurren FUERA del contexto de
 *    useGSAP: ahí un selector como '.chapter__label' deja de estar limitado a
 *    esta sección y alcanza a las dieciocho de la página.
 *  - **El texto entra por el lado en el que vive el bloque.** Un bloque a la
 *    derecha que entra desde la izquierda cruza la pantalla entera para
 *    llegar a su sitio, y se lee como que viene de otro lado.
 */
export default function Chapter({
  chapter,
  index,
  align = 'left',
  armed,
  reduced,
}: ChapterProps) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const scope = root.current;
      if (!armed || reduced || !chapter || !title.current || !scope) return;

      // Por elemento y no por selector: ver la nota de arriba.
      const label = scope.querySelector('.chapter__label');
      const inner = scope.querySelector('.chapter__inner');
      const parrafos = gsap.utils.toArray<HTMLElement>('.chapter__body p', scope);
      const nombres = gsap.utils.toArray<HTMLElement>('.chapter__nombre', scope);

      /** Hacia dónde apunta la entrada: +1 a la derecha, −1 a la izquierda. */
      const dir = align === 'right' ? 1 : -1;

      // Un nombre revuelto no mide lo mismo que el nombre: las letras que
      // entran son otras y más angostas, así que la línea se reacomoda
      // mientras dura el efecto y el párrafo entero tiembla. Se le fija el
      // ancho durante el revuelto y se suelta al terminar. La alternativa
      // —buscar letras que midan igual— no existe en una fuente proporcional.
      const fijarAncho = () =>
        nombres.forEach((el) => gsap.set(el, { width: el.getBoundingClientRect().width }));
      const soltarAncho = () => gsap.set(nombres, { width: 'auto' });

      const split = SplitText.create(title.current, {
        type: 'lines',
        mask: 'lines',
        // Sin clase propia, las líneas salen sin `class` y las máscaras que
        // GSAP les pone encima también: no habría de dónde agarrarlas desde
        // el CSS para devolverles el sitio que les come el recorte.
        linesClass: 'chapter__linea',
        // Vuelve a partir cuando cambia el ancho o terminan de cargar las
        // fuentes. Sin esto, un título partido con la fuente del sistema se
        // queda con los cortes de esa fuente cuando llega la de verdad, y al
        // girar un teléfono quedan líneas de una sola palabra.
        autoSplit: true,
        onSplit: (self) => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: scope,
              start: 'top 72%',
              end: 'bottom 55%',
              toggleActions: 'play none none reverse',
              // `toggleActions` solo actúa al cruzar el borde. Si el navegador
              // restauró el scroll a mitad de página, este capítulo ya está
              // dentro cuando se crea el disparador y el revelado no llegaría
              // nunca: el texto se quedaría invisible para siempre.
              onRefresh: (st) => {
                if (st.progress > 0 && st.animation) st.animation.progress(1);
              },
            },
          });

          tl.from(label, { opacity: 0, x: dir * 18, duration: 0.5, ease: 'power2.out' })
            // Sin `opacity` a propósito: la máscara ya las esconde enteras, y
            // desvanecerlas además le quita el sentido —una línea que sube
            // desde detrás de un dintel, no una que aparece de la nada.
            .from(
              self.lines,
              {
                yPercent: 118,
                xPercent: dir * 10,
                duration: 0.8,
                stagger: 0.09,
                ease: 'power3.out',
              },
              '-=0.25',
            )
            .from(
              parrafos,
              { opacity: 0, y: 22, x: dir * 14, duration: 0.7, stagger: 0.14, ease: 'power2.out' },
              '-=0.45',
            );

          // Los nombres de los que rompieron el mundo tardan un momento en
          // asentarse. `{original}` le dice al plugin que el destino es el
          // texto que ya está puesto, así que no hay que repetirlo acá.
          if (nombres.length) {
            tl.to(
              nombres,
              {
                duration: 0.9,
                ease: 'none',
                scrambleText: {
                  text: '{original}',
                  chars: 'lowerCase',
                  speed: 0.55,
                  revealDelay: 0.3,
                },
                stagger: 0.16,
                onStart: fijarAncho,
                onComplete: soltarAncho,
                onReverseComplete: soltarAncho,
              },
              '-=0.35',
            );
          }

          return tl;
        },
      });

      // Parallax suave del bloque completo, atado al scroll (scrub).
      gsap.to(inner, {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: scope,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Devuelve el título a como estaba y, de paso, mata la timeline que
      // `onSplit` dejó viva —con su ScrollTrigger— y los oyentes de resize y
      // de fuentes que `autoSplit` había puesto.
      return () => split.revert();
    },
    { scope: root, dependencies: [armed, reduced, chapter, align] },
  );

  // Un respiro: la sección existe para ocupar scroll y para que la cámara
  // tenga su estación, pero no hay nada que leer. Más corta que un capítulo,
  // que si no se hace larga la espera.
  if (!chapter) {
    return <section className="chapter chapter--rest" ref={root} data-chapter={index} aria-hidden="true" />;
  }

  return (
    <section
      className="chapter"
      ref={root}
      data-chapter={index}
      // La alternancia izquierda/derecha viene decidida de story.ts y no de
      // :nth-child(even), que contaba también el <header> del hero y las
      // secciones de respiro.
      data-align={align}
    >
      <div className="chapter__inner">
        <p className="chapter__label">
          <span className="chapter__rune" aria-hidden="true">
            {chapter.rune}
          </span>
          {chapter.label}
        </p>
        <h2 className="chapter__title" ref={title}>
          {chapter.title}
        </h2>
        <div className="chapter__body">
          {chapter.body.map((p, i) => (
            <p key={i}>{conNombres(p)}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
