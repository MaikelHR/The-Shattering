// ============================================================
//  EL PUENTE ENTRE GSAP Y EL MUNDO 3D
// ------------------------------------------------------------
//  Esta es la pieza clave del proyecto, y la idea que hay que
//  entender bien:
//
//  GSAP mueve el scroll. El mundo 3D tiene que reaccionar.
//  ¿Cómo se comunican sin destruir el rendimiento?
//
//  La tentación es usar useState: ScrollTrigger actualiza el
//  estado y React re-renderiza. NO HAGAS ESO. El scroll dispara
//  decenas de veces por segundo, y cada cambio de estado
//  re-renderizaría todo el árbol de React. Se traba.
//
//  La solución: un objeto mutable común. GSAP le ESCRIBE valores
//  y la escena 3D los LEE dentro de useFrame (su propio bucle,
//  a 60 fps). React nunca se entera de nada, y por eso va fluido.
//
//  Es el mismo patrón que un ref: datos que cambian todo el
//  tiempo pero no deben provocar renders.
// ============================================================

export interface ScrollState {
  /** Progreso total de la historia, de 0 a 1. */
  progress: number;
  /**
   * Dónde estamos en la lista de capítulos, con decimales: 0 es el primero
   * centrado en pantalla, 1.5 es a mitad de camino entre el segundo y el
   * tercero. Es la medida que usa el mundo 3D, porque es la que coincide
   * con lo que el lector tiene delante.
   */
  position: number;
  /** Índice del capítulo en curso (0, 1, 2...). */
  chapter: number;
  /** Progreso dentro del capítulo en curso, de 0 a 1. */
  chapterProgress: number;
  /** Velocidad del scroll en px/s, con signo. Sirve para inercia. */
  velocity: number;
}

export const scrollState: ScrollState = {
  progress: 0,
  position: 0,
  chapter: 0,
  chapterProgress: 0,
  velocity: 0,
};

/**
 * Scroll (en px) al que cada capítulo queda centrado en pantalla.
 * Lo mide App cada vez que ScrollTrigger recalcula el layout.
 */
let anchors: number[] = [];

export function setChapterAnchors(next: number[]): void {
  anchors = next;
}

/**
 * Traduce la posición del scroll a "en qué capítulo estamos".
 *
 * No alcanza con repartir el progreso total entre los capítulos: el hero
 * y el cierre también ocupan scroll, así que ese reparto deja la cámara
 * corrida. Con la posición real de cada sección, cuando el capítulo IV
 * está centrado la cámara está exactamente en el encuadre del IV, que es
 * lo único que el lector puede comprobar.
 */
function chapterPosition(scrollY: number, count: number): number {
  const last = Math.max(0, count - 1);
  if (anchors.length !== count || count < 2) return 0;
  if (scrollY <= anchors[0]) return 0;

  for (let i = 0; i < last; i++) {
    if (scrollY < anchors[i + 1]) {
      const span = anchors[i + 1] - anchors[i];
      return i + (span > 0 ? clamp((scrollY - anchors[i]) / span, 0, 1) : 0);
    }
  }
  return last;
}

/**
 * Único punto de escritura del puente.
 *
 * Lo llaman tanto `onUpdate` (mientras se scrollea) como `onRefresh`
 * (al montar y al recalcular el layout). Ese segundo caso importa:
 * si recargás a mitad de página el navegador restaura el scroll, pero
 * `onUpdate` no dispara hasta que movés la rueda. Sin este llamado la
 * cámara arranca en el capítulo I y después vuela hasta donde estabas.
 */
export function writeScroll(
  scrollY: number,
  progress: number,
  velocity: number,
  chapterCount: number,
): void {
  const last = Math.max(0, chapterCount - 1);
  const pos = chapterPosition(scrollY, chapterCount);
  // floor, no round: `chapter` es el capítulo del que venimos y
  // `chapterProgress` cuánto llevamos hacia el siguiente. Con round
  // los dos valores hablaban de capítulos distintos.
  const chapter = Math.min(last, Math.floor(pos));

  scrollState.progress = clamp(progress, 0, 1);
  scrollState.position = pos;
  scrollState.velocity = velocity;
  scrollState.chapter = chapter;
  scrollState.chapterProgress = pos - chapter;
}

/**
 * ScrollTrigger solo reporta velocidad mientras el scroll se mueve:
 * cuando el usuario suelta, el último valor se queda congelado ahí
 * para siempre. El mundo 3D llama a esto una vez por frame para que
 * la velocidad vuelva a cero sola.
 */
export function decayVelocity(delta: number): void {
  scrollState.velocity = damp(scrollState.velocity, 0, 6, delta);
}

/** Recorta un valor a un rango. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Interpolación lineal: mezcla a y b según t (0 a 1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Suavizado independiente del framerate.
 * Un lerp crudo dentro de useFrame va más rápido en pantallas de
 * 144Hz que en una de 60Hz. Esta versión corrige eso usando delta.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * delta));
}

/** Reasigna un valor de un rango a otro, recortado a los límites. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
}
