import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import Chapter from './components/Chapter';
import ChapterRail from './components/ChapterRail';
import Preloader, { PRELOADER_TIMEOUT } from './components/Preloader';
import { ALIGN, BEATS, CHAPTERS } from './story';
import { setChapterAnchors, writeScroll } from './scrollState';

/**
 * El mundo 3D llega aparte y después.
 *
 * Es medio mega de JavaScript —Three, R3F, drei y el postprocesado— contra
 * los setenta kilobytes de la página. Importándolo aquí arriba, el navegador
 * tiene que descargarlo y compilarlo entero antes de pintar una sola letra.
 * Con `lazy`, el texto se sirve de inmediato y el motor entra por detrás,
 * mientras la entrada se dibuja.
 *
 * Ojo: esto no quita ni un byte del total. Cambia cuándo llegan.
 */
const World = lazy(() => import('./world/World'));

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, useGSAP);

// En móvil, la barra de URL que aparece y desaparece cambia el alto del
// viewport y dispara un resize. Sin esto, ScrollTrigger remide toda la
// página a mitad de scroll y se nota el tirón.
ScrollTrigger.config({ ignoreMobileResize: true });

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export default function App() {
  const page = useRef<HTMLDivElement>(null);
  const smoother = useRef<ScrollSmoother | null>(null);
  const [active, setActive] = useState(0);
  /** El mundo 3D ya dibujó su primer frame. */
  const [worldReady, setWorldReady] = useState(false);
  /** La entrada terminó de salir: se puede desmontar y soltar el scroll. */
  const [revealed, setRevealed] = useState(false);
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

  // Tope de espera. El aviso del mundo llega desde un frame, y Chrome
  // congela el `requestAnimationFrame` en una pestaña de fondo: sin esto,
  // quien abra la página en segundo plano se queda con la pantalla negra.
  useEffect(() => {
    if (worldReady) return;
    const id = window.setTimeout(() => setWorldReady(true), PRELOADER_TIMEOUT * 1000);
    return () => window.clearTimeout(id);
  }, [worldReady]);

  // Mientras la entrada está puesta, el body va con `overflow: hidden`, así
  // que el scroll máximo es cero y ScrollTrigger midió con ese cero. Al
  // abrir hay que remedir, y de paso el `onRefresh` deja la cámara donde
  // toca sin esperar a que el lector mueva la rueda.
  useEffect(() => {
    if (revealed) ScrollTrigger.refresh();
  }, [revealed]);

  // Los capítulos crean sus propios disparadores, y no pueden hacerlo hasta
  // que exista el scroll suavizado: ScrollSmoother cambia el `scroller` por
  // defecto de ScrollTrigger, y lo que se crea antes se queda apuntando a la
  // ventana. React ejecuta los efectos de los hijos ANTES que los del padre,
  // así que los capítulos siempre irían primero. Esto los desarma hasta que
  // el efecto pasivo de App —que sí corre después— les da permiso.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);

  const { contextSafe } = useGSAP(
    () => {
      // ---- Scroll con inercia ----
      // Va lo primero de todo por lo que se explica arriba. Con movimiento
      // reducido no se crea: la inercia es movimiento que el usuario no pidió.
      //
      // `smoothTouch: 0` a propósito. En un móvil el propio sistema ya da
      // inercia, y sumarle otra encima se siente como si la página resbalara.
      if (!reduced) {
        smoother.current = ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 0.8,
          smoothTouch: 0,
          effects: false,
        });
      }

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

      // El hero se va desvaneciendo al bajar.
      if (!reduced) {
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

  // La entrada del título va aparte, y no en el bloque de arriba, porque
  // tiene que esperar a que la entrada se abra. Con el destello todavía en
  // pantalla se habría gastado a oscuras, y es el remate del momento: la
  // luz se retira y el título sube.
  useGSAP(
    () => {
      if (reduced || !revealed) return;
      gsap.from('.hero__line', {
        opacity: 0,
        y: 40,
        duration: 1.1,
        stagger: 0.16,
        ease: 'power3.out',
      });
    },
    { dependencies: [reduced, revealed] },
  );

  // contextSafe: el tween queda dentro del contexto de useGSAP, así que
  // se limpia solo si el componente se desmonta a mitad del viaje.
  //
  // El salto lo hace el propio smoother y no un tween sobre `window`: con el
  // scroll suavizado, la posición de la ventana y la que se ve son dos cosas
  // distintas, y animar la primera deja al lector mirando otro sitio.
  const goToChapter = contextSafe((index: number) => {
    const target = document.querySelector<HTMLElement>(`[data-chapter="${index}"]`);
    if (!target) return;

    const centrar = target.offsetTop + target.offsetHeight / 2 - window.innerHeight / 2;

    if (smoother.current) {
      // `smooth: true` deja que el propio suavizado haga el viaje.
      smoother.current.scrollTo(centrar, true);
    } else {
      window.scrollTo({ top: centrar, behavior: 'auto' });
    }
  });

  return (
    <>
      {/* El fallback va vacío a propósito: lo que se ve mientras tanto es la
          entrada, que está por encima y no depende de este Suspense. */}
      <Suspense fallback={null}>
        <World reduced={reduced} onReady={() => setWorldReady(true)} />
      </Suspense>

      {!revealed && (
        <Preloader ready={worldReady} reduced={reduced} onDone={() => setRevealed(true)} />
      )}

      <div className="progress" aria-hidden="true">
        <span className="progress__bar" />
      </div>

      <ChapterRail active={active} onSelect={goToChapter} />

      {/* El scroll suavizado envuelve SOLO el texto. Todo lo fijo —el canvas,
          el riel, la barra de progreso y la entrada— vive fuera a propósito:
          ScrollSmoother mueve `#smooth-content` con un transform, y lo que
          esté dentro se mueve con él por muy `position: fixed` que sea. */}
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <div className="page" ref={page}>
            <header className="hero">
              <p className="hero__eyebrow hero__line">Elden Ring · crónica de un orden roto</p>
              <h1 className="hero__title hero__line">Tierras Intermedias</h1>
              <p className="hero__sub hero__line">
                El Anillo se rompió y la luz quedó repartida entre quienes no supieron cuidarla.
              </p>
              <p className="hero__scroll hero__line">Desplazate para descender</p>
            </header>

            {/* Una sección por estación. Las que no llevan capítulo ocupan
                scroll y no muestran nada: son el respiro entre dos textos, y
                de paso el tramo donde la cámara viaja sin que nadie lea. */}
            {BEATS.map((beat, i) => (
              <Chapter
                key={i}
                chapter={beat.chapter}
                index={i}
                align={ALIGN.get(i)}
                armed={armed}
                reduced={reduced}
              />
            ))}

            <footer className="colophon">
              <p className="colophon__note">
                Mundo generado en tiempo real. La cámara sigue tu scroll: no hay video.
              </p>
              <p className="colophon__tech">React · Three.js · GSAP ScrollTrigger</p>
              <p className="colophon__legal">
                Proyecto de fan, sin fines comerciales. Elden Ring es de FromSoftware y Bandai
                Namco. Nada de lo que ves acá es material del juego: todo está dibujado con
                geometría.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
