import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { Chapter as ChapterData } from '../story';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface ChapterProps {
  /** Si falta, la sección es un respiro: ocupa scroll y no muestra nada. */
  chapter?: ChapterData;
  index: number;
  /** De qué lado va el bloque de texto. Lo decide `ALIGN` en story.ts. */
  align?: 'left' | 'right';
  reduced: boolean;
}

/**
 * Una estación de la historia.
 *
 * Lo que se aprende acá:
 *  - useGSAP() reemplaza a useEffect y limpia solo las animaciones
 *    al desmontar (sin él, ScrollTrigger deja basura acumulada).
 *  - El "scope" limita los selectores a este componente, así que
 *    '.chapter__body p' no se pisa con las otras secciones.
 *  - SplitText parte el título en palabras para revelarlas en
 *    cascada, con mask: true para que aparezcan detrás de un borde.
 *
 * OJO con SplitText y el scope: el scope de useGSAP funciona para
 * gsap.to/from, pero SplitText resuelve los selectores con su propio
 * querySelectorAll sobre el documento entero. Con un string ('.chapter__title')
 * cada capítulo parte los títulos de toda la página, se pisan entre sí y
 * terminan todos invisibles. Por eso le pasamos el elemento por ref.
 */
export default function Chapter({ chapter, index, align = 'left', reduced }: ChapterProps) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (reduced || !chapter || !title.current) return;

      const split = new SplitText(title.current, {
        type: 'words',
        mask: 'words',
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top 72%',
          end: 'bottom 55%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.from('.chapter__label', { opacity: 0, x: -18, duration: 0.5, ease: 'power2.out' })
        .from(
          split.words,
          { yPercent: 115, opacity: 0, duration: 0.75, stagger: 0.055, ease: 'power3.out' },
          '-=0.25',
        )
        .from(
          '.chapter__body p',
          { opacity: 0, y: 22, duration: 0.7, stagger: 0.14, ease: 'power2.out' },
          '-=0.4',
        );

      // Parallax suave del bloque completo, atado al scroll (scrub).
      gsap.to('.chapter__inner', {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });

      return () => split.revert();
    },
    { scope: root, dependencies: [reduced, chapter] },
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
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
