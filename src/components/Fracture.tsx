import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { shock } from '../world/mood';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);

/**
 * LA FRACTURA
 * ------------------------------------------------------------
 * El único momento de la crónica que no es un viaje sino un golpe.
 *
 * La sección del capítulo II se clava en pantalla durante metro y medio de
 * scroll, y ese tramo conduce una timeline con `scrub`: la grieta se dibuja,
 * el mundo pierde la luz y el color, un destello lo tapa todo y el color
 * vuelve más frío de lo que era. Todo bajo el dedo del lector, hacia
 * adelante y hacia atrás.
 *
 * Tres decisiones que vale la pena entender:
 *
 *  - **Se clava con `pin` y no con `position: sticky`.** Sticky sería más
 *    simple y aquí no funciona: ScrollSmoother mueve el contenido con un
 *    `transform`, y un elemento pegajoso dentro de algo que se transforma se
 *    mueve con ello. Con ScrollSmoother, el pin de ScrollTrigger tampoco usa
 *    `position: fixed` sino transformaciones, así que el `offsetTop` de las
 *    secciones —del que dependen las dieciocho anclas de cámara— no se toca.
 *
 *  - **El mundo 3D no lee esta timeline: lee un número.** La timeline anima
 *    `shock` en `world/mood.ts` y el Árbol, la niebla, el cielo y el
 *    postprocesado lo leen en su propio bucle. Es el puente de siempre.
 *
 *  - **Con movimiento reducido, el golpe sigue.** Lo que se apaga es la
 *    grieta y el destello, que son adorno y además luz que da en la cara.
 *    El scrub no es movimiento autónomo: no se mueve nada que el lector no
 *    esté moviendo con el dedo.
 */

/**
 * La grieta. Nace donde está el Anillo —arriba, en el centro— y se abre en
 * cuatro brazos con un par de ramas. Va en un viewBox de 1600×900 recortado
 * a la ventana, y el trazo no escala, así que se ve igual de fino en
 * cualquier pantalla.
 */
const CRACKS = [
  // Hacia arriba y a la izquierda, saliéndose por el borde.
  'M 820 180 L 700 118 L 646 22 L 600 -60',
  // Hacia la derecha, casi horizontal.
  'M 820 180 L 962 232 L 1030 188 L 1182 252 L 1284 208 L 1430 272 L 1620 240',
  // El brazo largo, hacia abajo y a la izquierda.
  'M 820 180 L 742 322 L 620 380 L 558 522 L 420 602 L 350 762 L 220 862 L 150 980',
  // Y el otro, hacia abajo y a la derecha.
  'M 820 180 L 902 344 L 1020 422 L 1082 580 L 1222 682 L 1290 862 L 1400 980',
  // Dos ramas cortas, que son las que hacen que parezca roto y no dibujado.
  'M 620 380 L 520 338 L 428 372',
  'M 1020 422 L 1122 378 L 1204 412',
];

export default function Fracture({ armed, reduced }: { armed: boolean; reduced: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!armed) return;
      const section = document.querySelector<HTMLElement>('[data-chapter="2"]');
      if (!section) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          // Metro y medio de pantalla clavado. Menos y el suceso se pasa de
          // largo; más y el lector empieza a pensar que la página se colgó.
          end: '+=150%',
          pin: true,
          pinSpacing: true,
          // `anticipatePin` adelanta el clavado un pelo: sin él, bajando
          // rápido se ve un salto de un frame al fijar el elemento.
          anticipatePin: 1,
          scrub: 1,
        },
      });

      // ---- El golpe, que lee el mundo 3D ----
      // Sube de golpe y baja despacio, como un golpe de verdad.
      tl.to(shock, { value: 1, duration: 0.28, ease: 'power3.in' }, 0.28).to(
        shock,
        { value: 0, duration: 0.62, ease: 'power2.out' },
        0.56,
      );

      if (reduced) return;

      // ---- La grieta ----
      // Nace apagada en el CSS y la timeline la enciende en su primer
      // fotograma. Sin esto, entre que el componente monta y `armed` da
      // permiso, la grieta se vería dibujada y quieta en mitad de la página.
      tl.set('.fracture__crack', { opacity: 1 }, 0);

      // Se dibuja desde el centro hacia afuera, cada brazo un poco después
      // que el anterior, y con `power4.in` para que el trazo salga disparado
      // en vez de deslizarse.
      tl.from(
        '.fracture__crack path',
        { drawSVG: '0% 0%', duration: 0.22, stagger: 0.035, ease: 'power4.in' },
        0.3,
      )
        // ---- El destello ----
        .to('.fracture__flash', { opacity: 1, duration: 0.05, ease: 'none' }, 0.53)
        .to('.fracture__flash', { opacity: 0, duration: 0.38, ease: 'power2.out' }, 0.6)
        // Y la grieta se cierra: no queda cicatriz en la pantalla, queda en
        // el mundo.
        .to('.fracture__crack', { opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.74);
    },
    { scope: root, dependencies: [armed, reduced] },
  );

  // Con movimiento reducido no se dibuja nada: la grieta y el destello son
  // adorno, y el destello además es un fogonazo blanco a pantalla completa.
  // El golpe del mundo sí sigue, porque lo mueve el dedo del lector.
  if (reduced) return <div className="fracture" ref={root} aria-hidden="true" />;

  return (
    <div className="fracture" ref={root} aria-hidden="true">
      <svg
        className="fracture__crack"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {CRACKS.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="fracture__flash" />
    </div>
  );
}
