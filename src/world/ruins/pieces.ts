import { BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { makeNoise } from '../terrain/noise';

// ============================================================
//  LA CANTERÍA
// ------------------------------------------------------------
//  Las cuatro piezas con las que está hecho todo lo que alguna
//  vez construyó alguien en este mundo: columna, columna rota,
//  sillar y dintel.
//
//  Están acá y no dentro de Ruins.tsx porque las usan dos sitios
//  —las ruinas del suelo y la ciudad que flota— y cada geometría
//  se calcula una sola vez y se comparte. Duplicarlas costaría el
//  doble de memoria para dibujar exactamente la misma piedra.
//
//  Lo que las hace creíbles no es la forma sino el desgaste: cada
//  pieza lleva los bordes comidos por ruido, y las columnas rotas
//  terminan en un filo irregular, nunca en un corte limpio.
// ============================================================

/** Erosiona una geometría empujando sus vértices con ruido. */
export function weather(geometry: BufferGeometry, seed: number, amount: number): BufferGeometry {
  const noise = makeNoise(seed);
  const position = geometry.attributes.position;
  const v = new Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n =
      noise(v.x * 2.4 + v.y * 1.3, v.z * 2.4 - v.y * 0.7) * 0.7 +
      noise(v.x * 7.1 - 3, v.z * 7.1 + 5) * 0.3;
    v.x += n * amount;
    v.z += n * amount;
    v.y += n * amount * 0.4;
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Una columna, con su basa y su capitel.
 *
 * Sin esos dos ensanchamientos un cilindro se lee como poste, y a
 * contraluz —que es como se ven casi siempre acá— la silueta es lo único
 * que llega. Si está rota, el remate queda dentado: es una fractura, no
 * un corte de sierra.
 */
export function columnGeometry(seed: number, broken: boolean): BufferGeometry {
  const geometry = new CylinderGeometry(0.42, 0.46, 1, 10, 14);
  const noise = makeNoise(seed);
  const position = geometry.attributes.position;
  const v = new Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const t = v.y + 0.5; // 0 abajo, 1 arriba

    let r = 1 + 0.44 * (1 - smoothstep(0, 0.075, t));
    if (!broken) r += 0.34 * smoothstep(0.87, 0.96, t);
    v.x *= r;
    v.z *= r;

    if (broken && t > 0.9) {
      const bite = noise(v.x * 6, v.z * 6) * 0.5 + 0.5;
      v.y -= bite * 0.26;
      v.x *= 1 + bite * 0.1;
      v.z *= 1 + bite * 0.1;
    }
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return weather(geometry, seed + 17, 0.03);
}

export function blockGeometry(seed: number): BufferGeometry {
  return weather(new BoxGeometry(1, 1, 1, 4, 4, 4), seed, 0.11);
}

export function lintelGeometry(seed: number): BufferGeometry {
  return weather(new BoxGeometry(1, 1, 1, 8, 3, 3), seed, 0.06);
}

/**
 * Las cuatro piezas, talladas una sola vez al cargar el módulo y
 * compartidas por todo el que construya con ellas.
 */
export const PIECES = {
  column: columnGeometry(311, false),
  brokenColumn: columnGeometry(733, true),
  block: blockGeometry(1201),
  lintel: lintelGeometry(1607),
};
