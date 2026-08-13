import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { groundFlatness, groundHeight } from '../terrain/heightfield';

// ============================================================
//  LAS RUINAS
// ------------------------------------------------------------
//  Acá la regla del resto del mundo se invierte. La roca y el
//  Árbol se leen como naturales porque su forma la decide un
//  proceso; una columna, en cambio, tiene que verse hecha a mano:
//  recta, repetida y alineada con sus hermanas.
//
//  Lo que hace creíble una ruina no es la forma, es el desgaste y
//  sobre todo la disposición: las columnas de un mismo sitio
//  guardan la fila y el espaciado, porque alguna vez sostuvieron
//  el mismo techo. Repartidas al azar por el campo se leerían
//  como postes.
// ============================================================

export type PieceKind = 'column' | 'brokenColumn' | 'block' | 'lintel';

export interface RuinsLayout {
  columns: Matrix4[];
  brokenColumns: Matrix4[];
  blocks: Matrix4[];
  lintels: Matrix4[];
}

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
 * Dónde estuvo cada edificio. Puestos a mano, y no al azar, por dos razones:
 * son cinco y se ven todos, y sobre todo porque tienen que caer lejos de donde
 * se para la cámara. Un emplazamiento a ocho unidades del ojo no se lee como
 * ruina: se lee como una columna gigante tapando el paisaje.
 *
 * Las cámaras miran hacia el centro desde el arco de 50° a 145°, así que los
 * sitios van repartidos por el resto de la circunferencia: quedan alrededor
 * del Árbol y a media distancia, que es donde se leen como lo que fueron.
 */
const SITES: { x: number; z: number; angle: number; kind: 'colonnade' | 'wall' | 'arch' }[] = [
  { x: -12, z: -10, angle: 0.4, kind: 'colonnade' },
  { x: 13, z: -9, angle: -0.9, kind: 'wall' },
  { x: -3, z: -18, angle: 1.9, kind: 'arch' },
  { x: 19, z: 4, angle: 2.6, kind: 'colonnade' },
  { x: -19, z: -2, angle: -0.3, kind: 'wall' },
];

export function buildRuins(seed = 5521): RuinsLayout {
  const random = mulberry32(seed);
  const out: RuinsLayout = { columns: [], brokenColumns: [], blocks: [], lintels: [] };

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();

  /** Coloca una pieza sobre el suelo, hundida lo justo para que no flote. */
  const place = (
    list: Matrix4[],
    x: number,
    z: number,
    height: number,
    width: number,
    angle: number,
    sink: number,
    lean = 0,
  ) => {
    const y = groundHeight(x, z);
    if (y < -1.5) return; // ya cayó por el acantilado
    position.set(x, y - sink + height / 2, z);
    // Una ruina en pie no está a plomo: mil años de suelo la desaploman.
    euler.set(Math.sin(angle * 3.1) * lean, angle, Math.cos(angle * 2.3) * lean);
    quaternion.setFromEuler(euler);
    scale.set(width, height, width);
    list.push(new Matrix4().compose(position, quaternion, scale));
  };

  /** Una columna tumbada: la imagen misma de una ruina. */
  const fell = (list: Matrix4[], x: number, z: number, length: number, width: number, angle: number) => {
    const y = groundHeight(x, z);
    if (y < -1.5) return;
    position.set(x, y + width * 0.38, z);
    // Volcada sobre un costado: el eje del cilindro pasa a ser horizontal.
    euler.set(Math.PI / 2, angle, 0);
    quaternion.setFromEuler(euler);
    scale.set(width, length, width);
    list.push(new Matrix4().compose(position, quaternion, scale));
  };

  for (const site of SITES) {
    const cos = Math.cos(site.angle);
    const sin = Math.sin(site.angle);
    /** Coordenadas locales del sitio a coordenadas del mundo. */
    const toWorld = (u: number, v: number): [number, number] => [
      site.x + u * cos - v * sin,
      site.z + u * sin + v * cos,
    ];

    if (site.kind === 'colonnade') {
      // Dos filas paralelas: lo que queda de una nave.
      const count = 3 + Math.floor(random() * 3);
      const spacing = 3.1 + random() * 0.6;
      const aisle = 4.2 + random() * 1.4;

      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < count; i++) {
          const [x, z] = toWorld((i - (count - 1) / 2) * spacing, (row - 0.5) * aisle);
          if (groundFlatness(x, z) < 0.7) continue;

          const luck = random();
          if (luck > 0.74) {
            // Se vino abajo entera y quedó tendida junto a su sitio.
            fell(
              out.columns,
              x + (random() - 0.5) * 1.6,
              z + (random() - 0.5) * 1.6,
              4 + random() * 2.5,
              0.78 + random() * 0.2,
              site.angle + (random() - 0.5) * 1.2,
            );
            continue;
          }

          const broken = luck > 0.4;
          const height = broken ? 1.6 + random() * 2.2 : 5 + random() * 2.6;
          place(
            broken ? out.brokenColumns : out.columns,
            x,
            z,
            height,
            0.78 + random() * 0.22,
            site.angle + (random() - 0.5) * 0.12,
            0.45,
            0.035 + random() * 0.05,
          );
        }
      }
    }

    if (site.kind === 'wall') {
      // Un muro que se va desmoronando hacia los extremos.
      const length = 6 + Math.floor(random() * 4);
      for (let i = 0; i < length; i++) {
        const t = i / (length - 1);
        // Más alto en el centro: los bordes son los primeros en caer.
        const profile = 1 - Math.abs(t - 0.5) * 1.7;
        if (profile < 0.12 || random() > 0.82) continue;

        const [x, z] = toWorld((i - (length - 1) / 2) * 1.85, 0);
        if (groundFlatness(x, z) < 0.7) continue;

        const height = 0.75 + profile * (2.2 + random() * 2.1);
        place(out.blocks, x, z, height, 1.7 + random() * 0.4, site.angle + (random() - 0.5) * 0.16, 0.4, 0.05);
      }
      // Escombro al pie del muro.
      for (let i = 0; i < 5; i++) {
        const [x, z] = toWorld((random() - 0.5) * length * 1.7, (random() - 0.5) * 3.2);
        if (groundFlatness(x, z) < 0.7) continue;
        place(out.blocks, x, z, 0.5 + random() * 0.4, 0.9 + random() * 0.6, random() * 3, 0.2);
      }
    }

    if (site.kind === 'arch') {
      // Dos columnas y lo que queda del dintel.
      const span = 3.4;
      const height = 5.4 + random() * 1.2;
      const legs: [number, number][] = [toWorld(-span / 2, 0), toWorld(span / 2, 0)];

      for (const [x, z] of legs) {
        place(out.columns, x, z, height, 0.95, site.angle, 0.45);
      }

      const [cx, cz] = toWorld(0, 0);
      const y = groundHeight(cx, cz);
      position.set(cx, y - 0.45 + height + 0.35, cz);
      euler.set(0, site.angle, 0.02);
      quaternion.setFromEuler(euler);
      scale.set(span + 1.6, 0.75, 1.15);
      out.lintels.push(new Matrix4().compose(position, quaternion, scale));

      // Y un par de piezas caídas del propio arco.
      for (let i = 0; i < 3; i++) {
        const [x, z] = toWorld((random() - 0.5) * 6, (random() - 0.5) * 4);
        if (groundFlatness(x, z) < 0.7) continue;
        place(out.blocks, x, z, 0.55 + random() * 0.5, 1 + random() * 0.7, random() * 3, 0.22);
      }
    }
  }

  return out;
}

/** Las ruinas de esta historia, trazadas una vez al cargar el módulo. */
export const RUINS = buildRuins();
