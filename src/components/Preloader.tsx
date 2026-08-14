import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin, useGSAP);

/**
 * LA ENTRADA
 * ------------------------------------------------------------
 * Una runa dorada que se dibuja sola sobre negro mientras el
 * mundo 3D se descarga, y un destello que lo abre.
 *
 * La runa es el Anillo partido en tres con el Árbol dentro: es
 * el emblema del proyecto y adelanta el capítulo II sin contarlo.
 *
 * Va de trazos y no de rellenos porque DrawSVG anima el guionado
 * del trazo (`stroke-dasharray`), así que lo que no tiene stroke
 * no se puede dibujar.
 *
 * Dos decisiones que valen más de lo que parecen:
 *
 *  - **No usa `useProgress` de drei.** Sería lo natural y arruina
 *    justamente lo que venimos a arreglar: importar drei acá lo
 *    mete en el chunk de entrada, que es el que queremos ligero.
 *    En vez de un porcentaje real, la runa se dibuja a su ritmo y
 *    espera; el mundo avisa cuando está.
 *
 *  - **Hay un tope de tiempo.** Si el mundo no avisa, la entrada
 *    se levanta igual. Chrome congela el `requestAnimationFrame`
 *    en una pestaña de fondo, y el aviso llega desde un frame:
 *    sin tope, quien abra la página en segundo plano se encuentra
 *    una pantalla negra para siempre.
 */

/** Cuánto se espera al mundo antes de abrir igual, en segundos. */
const TIMEOUT = 6;

/** El Anillo: tres arcos de 110° que juntos cierran el círculo. */
const ARCS = [
  'M 94.6 38.24 A 62 62 0 0 1 159.89 116.05',
  'M 156.19 126.2 A 62 62 0 0 1 56.16 143.84',
  'M 49.21 135.56 A 62 62 0 0 1 83.95 40.11',
];

/** El Árbol, dentro. El tronco primero y las ramas después. */
const TREE = [
  'M 100 146 L 100 72',
  'M 100 122 L 78 100',
  'M 100 130 L 124 108',
  'M 100 96 L 82 78',
  'M 100 88 L 120 70',
];

export default function Preloader({
  ready,
  reduced,
  onDone,
}: {
  /** El mundo 3D ya dibujó su primer frame. */
  ready: boolean;
  reduced: boolean;
  /** La entrada terminó de salir y se puede desmontar. */
  onDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const rune = useRef<SVGSVGElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(reduced);

  // ---- Entrada: la runa se dibuja ----
  useGSAP(
    () => {
      if (reduced) return;

      const tl = gsap.timeline({ onComplete: () => setDrawn(true) });
      tl.from('.preloader__ring path', {
        drawSVG: '0%',
        duration: 0.9,
        stagger: 0.12,
        ease: 'power2.inOut',
      })
        .from(
          '.preloader__tree path',
          { drawSVG: '0%', duration: 0.5, stagger: 0.07, ease: 'power2.out' },
          '-=0.55',
        )
        .to('.preloader__glow', { opacity: 1, duration: 0.5 }, '-=0.4');
    },
    { scope: root, dependencies: [reduced] },
  );

  // ---- Espera: un latido mientras el mundo termina de llegar ----
  useGSAP(
    () => {
      if (reduced || !drawn || ready) return;
      const tween = gsap.to(rune.current, {
        opacity: 0.55,
        duration: 1.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      return () => {
        tween.kill();
      };
    },
    { scope: root, dependencies: [drawn, ready, reduced] },
  );

  // ---- Salida: el destello que abre el mundo ----
  useGSAP(
    () => {
      if (!drawn || !ready) return;

      if (reduced) {
        // Sin movimiento: la entrada simplemente deja de estar.
        gsap.set(root.current, { opacity: 0 });
        onDone();
        return;
      }

      gsap
        .timeline({ onComplete: onDone })
        // El latido puede estar a mitad de camino: se recoge antes de crecer.
        .to(rune.current, { opacity: 1, duration: 0.15 })
        .to(rune.current, { scale: 1.5, opacity: 0, duration: 0.55, ease: 'power2.in' })
        .to(flash.current, { opacity: 1, duration: 0.3, ease: 'power1.in' }, '-=0.3')
        .to(root.current, { opacity: 0, duration: 0.8, ease: 'power2.inOut' });
    },
    { scope: root, dependencies: [drawn, ready, reduced] },
  );

  return (
    <div className="preloader" ref={root} role="status" aria-label="Cargando las Tierras Intermedias">
      <div className="preloader__flash" ref={flash} aria-hidden="true" />
      <svg
        className="preloader__rune"
        ref={rune}
        viewBox="0 0 200 200"
        aria-hidden="true"
        focusable="false"
      >
        {/* El halo, que aparece cuando la runa termina de dibujarse. */}
        <circle className="preloader__glow" cx="100" cy="100" r="62" />
        <g className="preloader__ring">
          {ARCS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="preloader__tree">
          {TREE.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}

export { TIMEOUT as PRELOADER_TIMEOUT };
