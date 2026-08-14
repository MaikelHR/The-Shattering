import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import type { AmbientLight, Mesh, MeshBasicMaterial } from 'three';
import { scrollState, damp } from '../scrollState';
import { burn, rot } from './mood';

/**
 * EL AIRE
 * ------------------------------------------------------------
 * La niebla, la luz de relleno y el color de los rayos. Son las
 * tres cosas que tiñen todo lo demás sin ser nada en sí mismas,
 * y por eso viven juntas.
 *
 * Cuando el este se pudre y cuando el Árbol arde, el mundo entero
 * cambia de color. Se podría hacer con un filtro en el
 * postprocesado —una vuelta de tono y listo— y se vería mal: un
 * filtro tiñe por igual lo cercano y lo lejano, y lo que hace
 * creíble un cambio de luz es justamente que no. Acá el rojo entra
 * por donde entraría de verdad: la distancia se llena de él, la luz
 * rebotada lo trae y los haces que bajan del Árbol lo llevan.
 */

/** El pardo verdoso de siempre, la podredumbre, y la ceniza. */
const HAZE = new Color('#232617');
const ROT_HAZE = new Color('#40160f');
const BURN_HAZE = new Color('#3d1f0c');

/** La luz de relleno: blanca, luego enferma, luego de brasa. */
const FILL = new Color('#ffffff');
const ROT_FILL = new Color('#ff5a3c');
const BURN_FILL = new Color('#ff8a44');

/** El emisor de los rayos, que es lo que les da color. */
const RAY = new Color('#f6cf96');
const BURN_RAY = new Color('#ff8434');

export default function Atmosphere({ sun }: { sun: Mesh | null }) {
  const fill = useRef<AmbientLight>(null);
  const sick = useRef(0);
  const fire = useRef(0);

  useFrame((state, delta) => {
    const pos = scrollState.position;
    sick.current = damp(sick.current, rot(pos), 2, delta);
    fire.current = damp(fire.current, burn(pos), 1.8, delta);

    // La niebla es lo que más lejos llega, así que es lo primero que se ve
    // cambiar: el horizonte se pone rojo antes que el suelo de al lado.
    const fog = state.scene.fog;
    if (fog) fog.color.lerpColors(HAZE, ROT_HAZE, sick.current).lerp(BURN_HAZE, fire.current);

    const f = fill.current;
    if (f) {
      f.color.lerpColors(FILL, ROT_FILL, sick.current).lerp(BURN_FILL, fire.current);
      f.intensity = 0.12 + sick.current * 0.1 + fire.current * 0.14;
    }

    // El material del emisor no se ve nunca —queda dentro de la copa— pero
    // es de donde GodRays saca el color de los haces.
    if (sun) (sun.material as MeshBasicMaterial).color.lerpColors(RAY, BURN_RAY, fire.current);
  });

  return <ambientLight ref={fill} intensity={0.12} />;
}
