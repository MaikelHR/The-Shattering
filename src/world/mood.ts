import { clamp, mapRange } from '../scrollState';

// ============================================================
//  LO QUE LE PASA AL MUNDO
// ------------------------------------------------------------
//  Cuatro cosas cambian mientras se lee, y las cuatro las
//  dispara el scroll: el Anillo se parte, el este se pudre, las
//  raíces se encienden y el Árbol arde.
//
//  Están todas acá y no repartidas por sus componentes, por una
//  razón práctica: los umbrales están escritos en números de
//  estación, así que meter una estación nueva en el medio corre
//  todo lo que viene después. Con seis archivos, esa corrección
//  se olvida en uno y el mundo se desincroniza del texto.
//
//  Son funciones puras de la posición: sin estado y sin
//  suavizado. Eso importa. Si guardaran estado, el resultado
//  dependería del orden en que los componentes corren su
//  useFrame, que es un detalle del montaje y no una decisión.
//  El que quiera suavizar, que lo haga por su cuenta con damp().
//
//  La excepción es `shock`, el golpe de la Fractura, que sí es
//  un valor mutable porque lo escribe una timeline y no una
//  rampa. Está explicado donde se declara. `blaze` lo mezcla:
//  es el único sitio donde las dos cosas se juntan.
//
//  Los números salen del recorrido de `story.ts`, y siempre son
//  un poco anteriores al capítulo que los cuenta: el mundo tiene
//  que estar cambiando cuando el texto lo nombra, no después.
// ============================================================

/**
 * EL GOLPE DE LA FRACTURA
 * ------------------------------------------------------------
 * La única excepción a lo de arriba, y con motivo. Los cuatro estados son
 * funciones de la posición porque describen **en qué punto del viaje está el
 * mundo**. La Fractura no es un punto del viaje: es un suceso escrito a mano
 * sobre una sección concreta, con su golpe, su destello y su recuperación,
 * y eso no se deja describir por una rampa.
 *
 * Así que lo escribe una timeline de GSAP con `scrub` (ver `Fracture.tsx`) y
 * lo lee el mundo. Que el DOM escriba y el 3D lea es exactamente el puente de
 * siempre —`scrollState`—, sólo que con un valor en vez de con el scroll.
 *
 * Al ser un objeto y no una variable suelta, GSAP puede animarlo directamente.
 */
export const shock = { value: 0 };

/**
 * II · El Anillo se abre en tres (estación 2).
 *
 * Sigue saliendo de la posición y no del golpe, aposta: que el Anillo se
 * rompa es la historia, no el adorno. Si algún día la Fractura no llegara a
 * montarse, el Anillo tiene que romperse igual.
 */
export function ringSplit(position: number): number {
  return mapRange(position, 1.55, 2.2, 0, 1);
}

/**
 * IV · La podredumbre escarlata (estación 6).
 *
 * Sube y baja, pero no vuelve a cero: Caelid queda al este y la cámara se
 * va, así que el rojo se retira al fondo en vez de curarse.
 */
export function rot(position: number): number {
  return Math.min(mapRange(position, 4.6, 6.0, 0, 1), mapRange(position, 6.7, 8.0, 1, 0.16));
}

/** V · Las raíces se encienden bajo la capital (estación 8). */
export function roots(position: number): number {
  return mapRange(position, 6.9, 8.2, 0, 1);
}

/** VIII · El Árbol arde, y no se apaga porque no vuelve a encenderse (15). */
export function burn(position: number): number {
  return mapRange(position, 14.3, 15.4, 0, 1);
}

/**
 * Cuánta luz da el Árbol, que es casi toda la del mundo.
 *
 * Se mantiene entera durante toda la crónica —el Árbol siguió dorado
 * después de la Fractura, lo que se rompió fue el Anillo— y solo cambia al
 * final: una llamarada cuando prende y después la mitad de lo que era.
 * Nunca llega a cero, o los dos últimos capítulos se leerían a oscuras.
 */
export function blaze(position: number): number {
  const flare = mapRange(position, 14.2, 15.0, 0, 1);
  const ash = mapRange(position, 15.0, 16.4, 0, 1);
  // Y el titubeo de la Fractura, que no es un cambio de estado sino un susto:
  // al Árbol le falla la luz cuando el Anillo se parte, y se recupera.
  const stumble = shock.value * 0.62;
  return clamp(1 + flare * 0.55 - ash * 1.05 - stumble, 0.3, 1.6);
}
