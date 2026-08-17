import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { GRACIAS } from '../story';
import { scrollState, mapRange } from '../scrollState';

/**
 * LAS MARCAS, COLOCADAS
 * ------------------------------------------------------------
 * Las cuatro Gracias viven en el mundo 3D, pero **no son geometría**: son
 * botones de HTML que este componente mueve a donde le toca a cada una.
 *
 * Parece al revés y no lo es. La alternativa —un sprite en la escena y un
 * rayo desde el ratón para saber cuál se pulsó— es la que primero se le
 * ocurre a uno, y tiene tres problemas que no se arreglan después:
 *
 *  - **No se puede llegar con el teclado.** Un objeto dentro de un canvas no
 *    está en el orden de tabulación, no recibe foco y no hay manera de darle
 *    uno. Quien no usa ratón se queda sin las cuatro notas.
 *  - **No existe para un lector de pantalla.** Un canvas es una imagen: lo
 *    que hay dentro no se anuncia.
 *  - **Y hay que resolver a mano** el hover, el foco, el cursor y el clic,
 *    que en un `<button>` vienen puestos.
 *
 * Con botones de verdad todo eso sale gratis y lo único que queda por hacer
 * es la cuenta de proyectar un punto del mundo a la pantalla, que son tres
 * líneas. El precio es que no los tapa el relieve —una marca detrás de una
 * montaña se vería igual—, y por eso cada una solo se enciende en el tramo de
 * la historia en el que la cámara la tiene delante.
 *
 * Los botones se buscan por `data-gracia` una sola vez. Es tosco, pero la
 * alternativa es pasar cuatro refs desde `App` hasta dentro del canvas
 * atravesando el componente que carga en diferido, y eso es más frágil que un
 * `querySelector` que corre al montar.
 *
 * Y se escriben con `style` directo, no con estado de React: esto ocurre en
 * cada frame, y es el mismo motivo por el que el puente con el scroll es un
 * objeto mutable y no un `useState`.
 */
/** Media estación de entrada y otra media de salida, fuera del tramo. */
const FUNDIDO = 0.5;

export default function Graces({ libre }: { libre: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const tmp = useRef(new Vector3());

  const points = useMemo(() => GRACIAS.map((g) => new Vector3(...g.at)), []);

  useEffect(() => {
    nodes.current = GRACIAS.map((g) =>
      document.querySelector<HTMLElement>(`[data-gracia="${g.id}"]`),
    );
  }, []);

  useFrame(() => {
    const pos = scrollState.position;

    for (let i = 0; i < GRACIAS.length; i++) {
      const el = nodes.current[i];
      if (!el) continue;
      const g = GRACIAS[i];

      // Con la cámara suelta la historia está parada, así que el tramo no
      // significa nada: se encienden las cuatro y buscarlas es la excusa para
      // dar la vuelta al mundo.
      //
      // El fundido va POR FUERA del tramo, no por dentro. Metiéndolo dentro,
      // `from` y `to` dejan de querer decir «acá se ve» y pasan a querer decir
      // «acá empieza a verse», y las marcas cuyo tramo arranca justo en su
      // capítulo —el Anillo en la estación 0, la Gracia en la 17— se quedaban
      // a cero en el único sitio donde tenían que estar encendidas.
      const enTramo = libre
        ? 1
        : Math.min(
            mapRange(pos, g.from - FUNDIDO, g.from, 0, 1),
            mapRange(pos, g.to, g.to + FUNDIDO, 1, 0),
          );

      if (enTramo <= 0.02) {
        // `visibility` y no solo `opacity`: un botón transparente sigue
        // recibiendo clics y sigue estando en el orden de tabulación.
        el.style.visibility = 'hidden';
        continue;
      }

      tmp.current.copy(points[i]).project(camera);
      // z > 1 es detrás de la cámara, y ahí la proyección devuelve un punto
      // reflejado: la marca aparecería en el lado contrario de la pantalla.
      if (tmp.current.z > 1) {
        el.style.visibility = 'hidden';
        continue;
      }

      const x = (tmp.current.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.current.y * 0.5 + 0.5) * size.height;

      el.style.visibility = 'visible';
      el.style.opacity = String(enTramo);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  });

  return null;
}
