import { useEffect, useMemo } from 'react';
import { Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import Batch from './ruins/Batch';
import { PIECES } from './ruins/pieces';
import { groundHeight } from './terrain/heightfield';

/**
 * LA CAPITAL, AL PIE DEL ÁRBOL
 * ------------------------------------------------------------
 * Leyndell en silueta: una muralla curvada, sus torres, y detrás
 * las agujas de la ciudad, con la mayor justo debajo del Árbol.
 *
 * Esto no está por decorar. **Es lo que hace que el Árbol se vea
 * enorme.** Un objeto grande y lejano no se lee como grande por sí
 * solo: hace falta algo entre el ojo y él a lo que el ojo le
 * conozca el tamaño. Hasta ahora había ruinas cerca (a cincuenta
 * unidades) y montañas lejos (a ciento cincuenta), y en medio no
 * había nada. La capital ocupa ese hueco, y de paso pone en el
 * cuadro lo único que la crónica nombra sin enseñar.
 *
 * Se monta con la técnica que ya funcionó en Farum Azula: las
 * mismas piezas de `ruins/pieces.ts`, instanciadas. A cien
 * unidades y a contraluz lo único que llega es la silueta, así que
 * no necesita ni texturas ni detalle — solo perfil.
 */

/** PRNG con semilla: la capital es siempre la misma. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * La muralla no es recta: se arquea alejándose por los extremos, como si
 * rodeara la ciudad. Una recta de ciento veinte unidades se lee como una
 * valla; una curva, como un recinto.
 */
const wallZ = (x: number) => -100 - (x / 60) ** 2 * 9;

interface Layout {
  blocks: Matrix4[];
  columns: Matrix4[];
  lintels: Matrix4[];
}

function buildCapital(seed = 6421): Layout {
  const random = mulberry32(seed);
  const out: Layout = { blocks: [], columns: [], lintels: [] };

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();

  /** Planta una pieza en el suelo, hundida un poco para que no flote. */
  const put = (
    list: Matrix4[],
    x: number,
    z: number,
    height: number,
    width: number,
    depth: number,
    yaw: number,
  ) => {
    const base = groundHeight(x, z) - 1;
    position.set(x, base + height / 2, z);
    euler.set(0, yaw, 0);
    quaternion.setFromEuler(euler);
    scale.set(width, height, depth);
    list.push(new Matrix4().compose(position, quaternion, scale));
  };

  // ---- La muralla ----
  // Lienzos anchos con almenas desiguales encima. Lo que hace que se lea
  // como muralla y no como una fila de cajas es que el remate no esté a la
  // misma altura en todos: mil años y un asedio dejan mella.
  for (let x = -56; x <= 66; x += 11.5) {
    const z = wallZ(x);
    const yaw = -Math.atan2(wallZ(x + 6) - wallZ(x - 6), 12);
    const height = 10 + random() * 3;
    put(out.blocks, x, z, height, 12, 6.5, yaw);
    // Y el parapeto, más fino y algo corrido.
    if (random() > 0.25) {
      put(out.blocks, x + (random() - 0.5) * 2, z - 0.6, height + 1.8 + random() * 1.2, 10, 3.4, yaw);
    }
  }

  // ---- Las torres de la muralla ----
  for (const x of [-49, -26, -3, 20, 43, 62]) {
    const z = wallZ(x);
    const yaw = -Math.atan2(wallZ(x + 6) - wallZ(x - 6), 12);
    const height = 16 + random() * 4;
    put(out.blocks, x, z, height, 7.5, 7.5, yaw);
    // Remate más estrecho: una torre que no se estrecha es una chimenea.
    put(out.blocks, x, z, height + 3.5 + random() * 1.5, 5, 5, yaw + 0.35);
  }

  // ---- La puerta ----
  // Dos torres juntas y el dintel cruzado. Es el único sitio donde la
  // silueta dice "acá se entra".
  const gateX = 6;
  const gateZ = wallZ(gateX);
  const gateBase = groundHeight(gateX, gateZ) - 1;
  for (const dx of [-6, 6]) {
    put(out.blocks, gateX + dx, wallZ(gateX + dx), 21, 8, 8, 0);
  }
  position.set(gateX, gateBase + 21.6, gateZ);
  euler.set(0, 0, 0);
  quaternion.setFromEuler(euler);
  scale.set(20, 3, 6);
  out.lintels.push(new Matrix4().compose(position, quaternion, scale));

  // ---- La ciudad de dentro ----
  // Agujas, más altas y más juntas hacia el centro, que es donde estaría el
  // palacio. La densidad no es decorativa: es lo que hace que el ojo lea un
  // centro y unos arrabales en vez de un pueblo repartido.
  for (let i = 0; i < 34; i++) {
    const t = random() * 2 - 1;
    const x = gateX + t * 52;
    const z = -114 - random() * 24;
    // Cuanto más cerca del centro, más alta.
    const centro = 1 - Math.abs(t);
    const height = 7 + centro * centro * 16 + random() * 6;
    const width = 3 + random() * 3.4;
    put(out.blocks, x, z, height, width, width, random() * 3);
    // Una de cada tres lleva encima una aguja fina.
    if (random() > 0.66) {
      put(out.columns, x, z, height + 4 + random() * 4, width * 0.5, width * 0.5, random() * 3);
    }
  }

  // ---- La gran torre ----
  // La única pieza puesta a mano, y va **corrida a un lado**: centrada queda
  // justo delante del tronco del Árbol y se lo come. Fuera del eje, se leen
  // los dos.
  //
  // Y se queda muy por debajo de la copa a propósito: si le llegara,
  // competirían y el Árbol dejaría de ser el sujeto.
  const torreX = gateX - 18;
  put(out.blocks, torreX, -128, 21, 11, 11, 0.2);
  put(out.blocks, torreX, -128, 28, 7.5, 7.5, 0.6);
  put(out.columns, torreX, -128, 36, 3.6, 3.6, 0);

  return out;
}

const CAPITAL = buildCapital();

export default function Capital() {
  const stone = useMemo(
    () =>
      new MeshStandardMaterial({
        // Piedra oscura y cálida. La capital está entre el ojo y el Árbol,
        // así que está siempre a contraluz: lo que se ve es su recorte contra
        // el resplandor, y una piedra clara lo estropearía.
        color: '#4a4034',
        roughness: 0.95,
        metalness: 0,
        flatShading: true,
      }),
    [],
  );
  useEffect(() => () => stone.dispose(), [stone]);

  return (
    <group>
      {/* Sin sombras: está a cien unidades, fuera del volumen que cubre el
          mapa de sombra de la direccional. */}
      <Batch geometry={PIECES.block} material={stone} matrices={CAPITAL.blocks} />
      <Batch geometry={PIECES.column} material={stone} matrices={CAPITAL.columns} />
      <Batch geometry={PIECES.lintel} material={stone} matrices={CAPITAL.lintels} />
    </group>
  );
}
