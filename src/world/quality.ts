// ============================================================
//  NIVELES DE CALIDAD
// ------------------------------------------------------------
//  El postprocesado es lo que hace que la escena se vea como una
//  captura del juego, y también lo primero que funde una GPU
//  integrada. Así que la cadena de efectos no es fija: se arma
//  según lo que el equipo aguante, y baja sola si no llega.
// ============================================================

export type Quality = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Rango de densidad de píxeles del canvas. */
  dpr: [number, number];
  /** Muestras de antialias del composer (0 lo desactiva). */
  multisampling: number;
  /** Los rayos de luz entre las ramas. Caros pero son la firma visual. */
  godRays: boolean;
  /** Muestras de los rayos: más muestras, haces más limpios. */
  godRaySamples: number;
  /** Desenfoque de profundidad. El más caro de todos. */
  depthOfField: boolean;
  /** Oclusión ambiental: el peso de las cosas. */
  ambientOcclusion: boolean;
  aoQuality: 'performance' | 'low' | 'medium' | 'high' | 'ultra';
  /** A media resolución cuesta la cuarta parte y casi no se nota. */
  aoHalfRes: boolean;
  /** Resolución del mapa de sombras. 0 las apaga. */
  shadowMap: number;
  /** Partículas y estrellas. */
  particles: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], multisampling: 0, godRays: true, godRaySamples: 60, depthOfField: true, ambientOcclusion: true, aoQuality: 'medium', aoHalfRes: false, shadowMap: 2048, particles: 1 },
  medium: { dpr: [1, 1.5], multisampling: 0, godRays: true, godRaySamples: 28, depthOfField: false, ambientOcclusion: true, aoQuality: 'performance', aoHalfRes: true, shadowMap: 1024, particles: 0.6 },
  low: { dpr: [1, 1], multisampling: 0, godRays: false, godRaySamples: 0, depthOfField: false, ambientOcclusion: false, aoQuality: 'performance', aoHalfRes: true, shadowMap: 0, particles: 0.35 },
};

/**
 * Primera apuesta, antes de haber dibujado un solo frame.
 *
 * No hay forma fiable de saber qué GPU hay del otro lado (y preguntarlo
 * por WEBGL_debug_renderer_info está cada vez más restringido), así que
 * esto es una conjetura razonable: el PerformanceMonitor de la escena
 * corrige el tiro en cuanto empiezan a contarse frames de verdad.
 */
export function detectQuality(): Quality {
  // ?q=low|medium|high fuerza un nivel y desactiva el ajuste automático.
  // Sirve para comparar la cadena completa contra la recortada sin tener
  // que cambiar de equipo, y para ver qué efecto se está comiendo los frames.
  const forced = new URLSearchParams(window.location.search).get('q');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const touch = window.matchMedia('(pointer: coarse)').matches;

  if (touch && (cores <= 6 || memory <= 4)) return 'low';
  if (touch) return 'medium';
  if (cores >= 8 && memory >= 8) return 'high';
  if (cores <= 4) return 'low';
  return 'medium';
}

/** Un escalón para abajo, cuando los frames no dan. */
export function downgrade(q: Quality): Quality {
  return q === 'high' ? 'medium' : 'low';
}

/** Con el nivel forzado por URL, nadie lo toca. */
export function isForced(): boolean {
  return ['low', 'medium', 'high'].includes(
    new URLSearchParams(window.location.search).get('q') ?? '',
  );
}
