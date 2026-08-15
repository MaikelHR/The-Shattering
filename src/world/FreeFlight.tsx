import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { groundHeight } from './terrain/heightfield';
import { clamp } from '../scrollState';

/**
 * EL VUELO LIBRE
 * ------------------------------------------------------------
 * Cuando la crónica termina, la cámara se suelta. Es lo que hace que la gente
 * se quede: hasta acá el mundo era un decorado que pasaba por detrás del
 * texto, y de pronto resulta que estaba todo ahí y se puede mirar.
 *
 * **Dónde está el punto de giro es la única decisión que importa.** Lo obvio
 * es girar alrededor del centro de la llanura, que es donde el lector estuvo
 * todo el rato, y sale mal: el Árbol mide casi doscientas unidades y está a
 * ciento setenta y ocho al norte, así que desde el suelo su copa queda a
 * treinta y cinco grados de altura. Mirando al centro de la llanura, que está
 * a cero grados, la copa se sale del cuadro por arriba —el lente abre
 * cuarenta y cinco grados, o sea veintidós y medio hacia arriba— y lo que
 * queda es un descampado con montañas al fondo.
 *
 * Así que el punto de giro va alto y al norte: a cuarenta de altura y setenta
 * hacia el Árbol. Desde ahí la mirada sube dieciséis grados, que es
 * exactamente lo que hacen los encuadres escritos de la crónica —la última
 * estación sube diecisiete y medio—, y el Árbol entra entero. Y de paso, la
 * transición al soltar la cámara no se ve: la deja mirando casi adonde ya
 * estaba mirando.
 *
 * El resto son límites, y no son desconfianza sino encuadre. Sin ellos se
 * acaba bajo tierra, dentro de una montaña o de espaldas a todo, y en
 * cualquiera de esos sitios el mundo se ve peor que en el peor de los
 * encuadres escritos.
 */

/**
 * El punto de giro: alto, y hacia el Árbol.
 * (Ver arriba: es lo que decide si el Árbol entra en el cuadro o no.)
 */
const CENTRO = new Vector3(0, 40, -70);

/** Cuánto tiene que despegar la cámara del suelo, como mínimo. */
const CLARO = 5;

export default function FreeFlight({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useRef<OrbitControlsImpl>(null);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;

    // El techo del ángulo polar se recalcula en cada frame, y tiene que ser
    // así: es el ángulo al que la cámara toca el suelo, y depende de lo lejos
    // que esté. Un valor fijo o deja la cámara flotando a treinta unidades
    // cuando está cerca, o la mete bajo tierra cuando está lejos —y el
    // terreno solo tiene cara de arriba, así que desde abajo no se dibuja y
    // lo que se ve no es un fallo, es un mundo sin suelo.
    const suelo = groundHeight(camera.position.x, camera.position.z) + CLARO;
    c.maxPolarAngle = Math.acos(clamp((suelo - CENTRO.y) / c.getDistance(), -0.995, 0.995));
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      // Los eventos del canvas se escuchan en `document.body` (el texto está
      // encima y lo tapa), y los controles heredarían ese destino. Ahí Chrome
      // trata la rueda como pasiva y no deja frenar el desplazamiento: la
      // rueda alejaría la cámara Y bajaría la página a la vez. En el propio
      // canvas, el `preventDefault` vale.
      domElement={gl.domElement}
      target={CENTRO}
      // No se pasea, se orbita: el centro no se mueve, así que siempre se
      // está mirando al Árbol o a la llanura, nunca a la nada.
      enablePan={false}
      enableDamping={!reduced}
      dampingFactor={0.05}
      rotateSpeed={0.4}
      zoomSpeed={0.75}
      minDistance={60}
      maxDistance={190}
      minPolarAngle={0.5}
      // Girar del todo alrededor deja la cámara al norte del Árbol, y ahí
      // solo quedan ciento doce unidades de mundo antes del borde. Con esto
      // se recorre el sur entero, que es donde está todo.
      minAzimuthAngle={-2}
      maxAzimuthAngle={2}
      // Un giro lentísimo mientras nadie toca: le dice al visitante que esto
      // se mueve, sin obligarlo a descubrirlo. Se para en cuanto arrastra.
      autoRotate={!reduced}
      autoRotateSpeed={0.14}
    />
  );
}
