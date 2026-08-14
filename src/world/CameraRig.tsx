import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { BEATS } from '../story';
import { scrollState, damp, clamp, lerp, decayVelocity } from '../scrollState';

/** Cuántos grados se abre el lente scrolleando a fondo. 0 lo desactiva. */
const FOV_KICK = 3.5;
/** Velocidad de scroll (px/s) que ya cuenta como "a fondo". */
const FULL_TILT = 2600;

/**
 * LA CÁMARA ATADA AL SCROLL
 * ------------------------------------------------------------
 * Cada capítulo define dónde está la cámara y hacia dónde mira.
 * Acá convertimos el progreso continuo (0 a 1) en una posición
 * interpolada entre esos puntos, y además la suavizamos con damp()
 * para que el movimiento no se sienta rígido ni salte si el
 * usuario hace scroll de golpe.
 *
 * Ojo: leemos scrollState directamente, sin estado de React.
 * Por eso esto corre a 60fps sin re-renderizar nada.
 */
export default function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera } = useThree();
  const targetPos = useRef(new Vector3(...BEATS[0].camera));
  const targetLook = useRef(new Vector3(...BEATS[0].lookAt));
  const currentLook = useRef(new Vector3(...BEATS[0].lookAt));
  const tmpA = useRef(new Vector3());
  const tmpB = useRef(new Vector3());
  const baseFov = useRef((camera as PerspectiveCamera).fov);
  const settled = useRef(false);

  useFrame((state, delta) => {
    // Este es el único useFrame garantizado en escena, así que acá se
    // apaga la velocidad: ScrollTrigger solo la reporta mientras el
    // scroll se mueve y, al soltar, el último valor quedaría clavado.
    decayVelocity(delta);

    const last = BEATS.length - 1;
    // Posición continua dentro de la lista de estaciones: 0 -> last
    const pos = clamp(scrollState.position, 0, last);
    const i = Math.max(0, Math.min(last - 1, Math.floor(pos)));
    const next = BEATS[Math.min(last, i + 1)];
    const f = pos - i;

    // Interpolamos entre el capítulo i y el siguiente
    tmpA.current.set(...BEATS[i].camera);
    tmpB.current.set(...next.camera);
    targetPos.current.copy(tmpA.current).lerp(tmpB.current, f);

    tmpA.current.set(...BEATS[i].lookAt);
    tmpB.current.set(...next.lookAt);
    targetLook.current.copy(tmpA.current).lerp(tmpB.current, f);

    // Adaptación del encuadre a la forma de la ventana. El fov vertical es
    // fijo, así que una pantalla vertical ve muchísimo menos a lo ancho: el
    // corrimiento que en un monitor deja al sujeto en el lado libre, en un
    // teléfono lo saca de cuadro. Acá se devuelve al centro y se toma
    // distancia, en proporción a lo angosta que sea la ventana.
    const portrait = 1 - clamp((state.size.width / state.size.height - 0.9) / 0.7, 0, 1);
    if (portrait > 0) {
      targetLook.current.x -= lerp(BEATS[i].frame, next.frame, f) * portrait;
      // Mirar más abajo sube el sujeto en el encuadre, que es donde queda
      // el hueco cuando el texto se va al pie de la pantalla.
      targetLook.current.y -= 2.6 * portrait;
      targetPos.current.sub(targetLook.current).multiplyScalar(1 + portrait * 0.42);
      targetPos.current.add(targetLook.current);
    }

    // Deriva sutil con el mouse, para que la escena se sienta viva.
    if (!reduced) {
      targetPos.current.x += state.pointer.x * 0.7;
      targetPos.current.y += state.pointer.y * 0.4;
    }

    // Primer frame: la cámara se planta en su sitio en vez de perseguirlo.
    // Si recargaste a mitad de la historia, el objetivo ya es el capítulo
    // que estabas leyendo, y sin esto la verías llegar volando desde el I.
    if (!settled.current) {
      settled.current = true;
      camera.position.copy(targetPos.current);
      currentLook.current.copy(targetLook.current);
      camera.lookAt(currentLook.current);
      return;
    }

    // Suavizado: la cámara persigue al objetivo, no salta a él.
    const l = reduced ? 12 : 2.6;
    camera.position.x = damp(camera.position.x, targetPos.current.x, l, delta);
    camera.position.y = damp(camera.position.y, targetPos.current.y, l, delta);
    camera.position.z = damp(camera.position.z, targetPos.current.z, l, delta);

    currentLook.current.x = damp(currentLook.current.x, targetLook.current.x, l, delta);
    currentLook.current.y = damp(currentLook.current.y, targetLook.current.y, l, delta);
    currentLook.current.z = damp(currentLook.current.z, targetLook.current.z, l, delta);
    camera.lookAt(currentLook.current);

    // El lente se abre un poco cuando bajás rápido y se cierra al frenar.
    // Es sutil a propósito: se nota como impulso, no como zoom.
    if (!reduced && FOV_KICK > 0) {
      const cam = camera as PerspectiveCamera;
      const rush = clamp(Math.abs(scrollState.velocity) / FULL_TILT, 0, 1);
      const fov = damp(cam.fov, baseFov.current + rush * FOV_KICK, 3, delta);
      if (Math.abs(fov - cam.fov) > 0.005) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
  });

  return null;
}
