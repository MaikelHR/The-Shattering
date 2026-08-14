import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import World from './world/World';
import Chapter from './components/Chapter';
import ChapterRail from './components/ChapterRail';
import { ALIGN, BEATS, CHAPTERS } from './story';
import { setChapterAnchors, writeScroll } from './scrollState';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);

// En móvil, la barra de URL que aparece y desaparece cambia el alto del
// viewport y dispara un resize. Sin esto, ScrollTrigger remide toda la
// página a mitad de scroll y se nota el tirón.
ScrollTrigger.config({ ignoreMobileResize: true });

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export default function App() {
  const page = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Se lee en el inicializador, no en un efecto posterior: si arrancara
  // en false, quien pide movimiento reducido vería el primer render
  // animado antes de que la corrección llegue.
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);

  // Y se sigue escuchando, porque la preferencia puede cambiar en caliente.
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION);
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Las fuentes de Google llegan después del primer layout y mueven todo
  // el texto. ScrollTrigger ya había medido con la fuente de sistema, así
  // que sin este refresh los capítulos se disparan en el punto equivocado.
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) ScrollTrigger.refresh();
    });
    return () => {
      alive = false;
    };
  }, []);

  const { contextSafe } = useGSAP(
    () => {
      // A qué altura de scroll queda centrada cada sección. Es lo que le
      // permite al mundo 3D estar en el encuadre de la estación que se está
      // leyendo, y no en el que tocaría por regla de tres. Se miden todas,
      // también los respiros: son estaciones de pleno derecho para la cámara.
      const measureChapters = () =>
        setChapterAnchors(
          BEATS.map((_, i) => {
            const el = document.querySelector<HTMLElement>(`[data-chapter="${i}"]`);
            if (!el) return 0;
            return el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2;
          }),
        );

      // ---- ScrollTrigger maestro ----
      // Un solo trigger cubre toda la página y ESCRIBE en scrollState.
      // El mundo 3D lo lee en su propio bucle. Ese es todo el puente.
      ScrollTrigger.create({
        trigger: page.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) =>
          writeScroll(self.scroll(), self.progress, self.getVelocity(), BEATS.length),
        // onRefresh también, no solo onUpdate: al montar (y cuando el
        // navegador restaura el scroll tras recargar) nadie mueve la
        // rueda, y la cámara se quedaría esperando en el capítulo I.
        onRefresh: (self) => {
          measureChapters();
          writeScroll(self.scroll(), self.progress, 0, BEATS.length);
        },
      });

      // Capítulo activo para el riel: esto SÍ usa estado de React,
      // porque cambia pocas veces y necesita re-renderizar la UI.
      //
      // onEnter/onEnterBack y no onToggle: si el usuario arrastra la barra
      // de scroll o pulsa Fin, ScrollTrigger salta por encima de secciones
      // enteras que nunca llegan a estar activas. Esos saltos igual disparan
      // onEnter, mientras que onToggle se los pierde y el riel se queda
      // marcando un capítulo que ya no es donde estás.
      CHAPTERS.forEach((chapter, order) => {
        const markActive = () => setActive(order);
        ScrollTrigger.create({
          trigger: `[data-chapter="${chapter.index}"]`,
          start: 'top 55%',
          end: 'bottom 55%',
          onEnter: markActive,
          onEnterBack: markActive,
          onRefresh: (self) => self.isActive && markActive(),
        });
      });

      // Barra de progreso superior, atada al scroll con scrub.
      gsap.to('.progress__bar', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: page.current, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
      });

      // Entrada del título principal.
      if (!reduced) {
        gsap.from('.hero__line', {
          opacity: 0,
          y: 40,
          duration: 1.1,
          stagger: 0.16,
          ease: 'power3.out',
          delay: 0.25,
        });
        gsap.to('.hero', {
          opacity: 0,
          y: -70,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
    },
    { dependencies: [reduced] },
  );

  // contextSafe: el tween queda dentro del contexto de useGSAP, así que
  // se limpia solo si el componente se desmonta a mitad del viaje.
  const goToChapter = contextSafe((index: number) => {
    const target = document.querySelector<HTMLElement>(`[data-chapter="${index}"]`);
    if (!target) return;

    if (reduced) {
      window.scrollTo({ top: target.offsetTop, behavior: 'auto' });
      return;
    }

    gsap.to(window, {
      duration: 1.1,
      ease: 'power2.inOut',
      scrollTo: { y: target, autoKill: true }, // autoKill: si tocás la rueda, manda el usuario
    });
  });

  return (
    <>
      <World reduced={reduced} />

      <div className="progress" aria-hidden="true">
        <span className="progress__bar" />
      </div>

      <ChapterRail active={active} onSelect={goToChapter} />

      <div className="page" ref={page}>
        <header className="hero">
          <p className="hero__eyebrow hero__line">Elden Ring · crónica de un orden roto</p>
          <h1 className="hero__title hero__line">Tierras Intermedias</h1>
          <p className="hero__sub hero__line">
            El Anillo se rompió y la luz quedó repartida entre quienes no supieron cuidarla.
          </p>
          <p className="hero__scroll hero__line">Desplazate para descender</p>
        </header>

        {/* Una sección por estación. Las que no llevan capítulo ocupan scroll
            y no muestran nada: son el respiro entre dos textos, y de paso el
            tramo donde la cámara hace su viaje sin que nadie lea. */}
        {BEATS.map((beat, i) => (
          <Chapter
            key={i}
            chapter={beat.chapter}
            index={i}
            align={ALIGN.get(i)}
            reduced={reduced}
          />
        ))}

        <footer className="colophon">
          <p className="colophon__note">
            Mundo generado en tiempo real. La cámara sigue tu scroll: no hay video.
          </p>
          <p className="colophon__tech">React · Three.js · GSAP ScrollTrigger</p>
          <p className="colophon__legal">
            Proyecto de fan, sin fines comerciales. Elden Ring es de FromSoftware y Bandai Namco.
            Nada de lo que ves acá es material del juego: todo está dibujado con geometría.
          </p>
        </footer>
      </div>
    </>
  );
}
