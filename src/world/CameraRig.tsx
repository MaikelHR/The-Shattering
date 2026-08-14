import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { BEATS } from '../story';
import { groundHeight } from './terrain/heightfield';
import { scrollState, damp, clamp, lerp, decayVelocity } from '../scrollState';

/** Cuántos grados se abre el lente scrolleando a fondo. 0 lo desactiva. */
const FOV_KICK = 3.5;
/** Velocidad de scroll (px/s) que ya cuenta como "a fondo". */
const FULL_TILT = 2600;
/**
 * Cuánto baja la mirada en una pantalla vertical, en radianes. Bajar la
 * mirada sube el sujeto en el cuadro, que es donde queda el hueco cuando el
 * texto se va al pie. Tres grados y no más: los sujetos de esta historia son
 * cosas altas —copas, un anillo en el cielo, una ciudad que flota— y ya
 * viven en la mitad de arriba del cuadro. Con seis se salían por encima.
 */
const PORTRAIT_LIFT = (3 * Math.PI) / 180;
/**
 * Cuánto retrocede la cámara en vertical: una fracción de lo que hay hasta el
 * punto de mira, con un tope en unidades de mundo.
 *
 * El tope es lo importante. Sin él, el retroceso es proporcional a la
 * distancia del punto de mira, que en los planos generales está en el
 * horizonte: en el capítulo I daban sesenta y tres unidades, y eso no es dar
 * un paso atrás, es mudarse. La cámara se salía de la zona amueblada —la
 * hierba llega a 34 unidades del centro y las piedras a 33— y el primer plano
 * se quedaba pelado.
 */
const PORTRAIT_BACK = 0.28;
const PORTRAIT_BACK_MAX = 16;
/** Cuántos grados se abre el lente en una pantalla vertical. */
const PORTRAIT_FOV = 11;
/** Cuánto tiene que despegar la cámara del suelo, como mínimo. */
const CLEARANCE = 1.6;

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

    // ---- Adaptación del encuadre a la forma de la ventana ----
    // El fov de three es el VERTICAL y es fijo, así que en una pantalla
    // vertical no se pierde nada de alto: lo que se pierde es ancho. De ahí
    // salen las tres correcciones, y ninguna toca el alto del encuadre.
    const portrait = 1 - clamp((state.size.width / state.size.height - 0.9) / 0.7, 0, 1);
    if (portrait > 0) {
      // 1. Deshacer el corrimiento de composición. El desplazamiento que en un
      //    monitor deja al sujeto en el lado libre, en un teléfono lo saca.
      targetLook.current.x -= lerp(BEATS[i].frame, next.frame, f) * portrait;

      // 2. Tomar distancia, y SOLO en horizontal. Escalar el vector completo
      //    cámara→mirada parece lo natural y hunde la cámara bajo tierra: casi
      //    todos los encuadres miran hacia arriba, así que "hacia atrás" a lo
      //    largo del eje de vista es también "hacia abajo", y un 42% de una
      //    mirada que sube cuarenta unidades son dieciocho de caída. Con esto,
      //    la cámara retrocede a su misma altura, que es lo que hace uno.
      const dx = targetPos.current.x - targetLook.current.x;
      const dz = targetPos.current.z - targetLook.current.z;
      const away = Math.hypot(dx, dz);
      if (away > 0.001) {
        const step = Math.min(away * PORTRAIT_BACK, PORTRAIT_BACK_MAX) * portrait;
        targetPos.current.x += (dx / away) * step;
        targetPos.current.z += (dz / away) * step;
      }

      // 3. Subir el sujeto en el cuadro, que es donde queda el hueco cuando el
      //    texto se va al pie. Se hace bajando la mirada un ÁNGULO y no unas
      //    unidades de mundo: dos unidades y media son medio grado en un plano
      //    lejano y seis en uno cercano, así que en unidades la corrección no
      //    hace nada donde hace falta y se pasa donde no.
      const flat = Math.hypot(
        targetLook.current.x - targetPos.current.x,
        targetLook.current.z - targetPos.current.z,
      );
      if (flat > 0.001) {
        const rise = Math.atan2(targetLook.current.y - targetPos.current.y, flat);
        targetLook.current.y =
          targetPos.current.y + Math.tan(rise - PORTRAIT_LIFT * portrait) * flat;
      }
    }

    // Deriva sutil con el mouse, para que la escena se sienta viva.
    if (!reduced) {
      targetPos.current.x += state.pointer.x * 0.7;
      targetPos.current.y += state.pointer.y * 0.4;
    }

    // Red de seguridad: la cámara nunca por debajo del suelo. No es paranoia.
    // El terreno solo tiene cara de arriba, así que desde abajo no se dibuja:
    // cuando esto pasa no se ve un fallo, se ve un mundo sin suelo, y uno se
    // pone a buscar la causa en la niebla o en las luces. Con las estaciones
    // escritas a mano y la corrección de vertical moviéndolas, hace falta.
    const floor = groundHeight(targetPos.current.x, targetPos.current.z) + CLEARANCE;
    if (targetPos.current.y < floor) targetPos.current.y = floor;

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

    // El lente. Dos cosas lo abren: la forma de la ventana y la velocidad.
    //
    // Lo de la ventana es la cuarta corrección de vertical, y la única que no
    // se puede hacer moviendo la cámara. Con el mismo fov, una pantalla de
    // teléfono ve veintidós grados de ancho contra los setenta y siete de un
    // monitor: el Árbol mide treinta y cinco de ancho y no entra. Retroceder
    // lo que haría falta son trescientas sesenta y siete unidades hasta el
    // Árbol, o sea salirse del mundo. Así que se abre el lente, que es
    // exactamente lo que hace la cámara de un teléfono por el mismo motivo.
    const cam = camera as PerspectiveCamera;
    const rush = reduced ? 0 : clamp(Math.abs(scrollState.velocity) / FULL_TILT, 0, 1);
    const wanted = baseFov.current + portrait * PORTRAIT_FOV + rush * FOV_KICK;
    // Con movimiento reducido no hay que suavizar nada: el fov solo depende
    // de la forma de la ventana, y esa no es una animación.
    const fov = reduced ? wanted : damp(cam.fov, wanted, 3, delta);
    if (Math.abs(fov - cam.fov) > 0.005) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
