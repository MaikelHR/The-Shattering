import { BufferGeometry, Float32BufferAttribute } from 'three';
import { fbm, makeNoise, ridged } from './noise';

// ============================================================
//  EL TERRENO
// ------------------------------------------------------------
//  Una meseta continental con el Árbol en el centro y acantilados
//  que caen a la niebla. Nada de cilindros: la silueta la decide
//  el ruido, igual que en el Árbol la decide la ramificación.
//
//  El borde no es un círculo. El radio al que empieza el acantilado
//  se modula con ruido angular, así que la costa entra y sale como
//  una costa de verdad. Es el detalle que más se nota de lejos.
// ============================================================

export interface TerrainParams {
  seed: number;
  /** Lado del terreno en unidades de mundo. */
  size: number;
  /** Vértices por lado. Más resolución, más detalle y más memoria. */
  segments: number;
  /** Radio medio al que empieza el acantilado. */
  edgeRadius: number;
  /** Cuánto entra y sale la costa respecto de ese radio. */
  edgeVariation: number;
  /** Hasta dónde baja el acantilado antes de perderse en la niebla. */
  cliffDepth: number;
  /** Altura de las lomas de la meseta. */
  relief: number;
}

export const DEFAULT_TERRAIN: TerrainParams = {
  seed: 8213,
  size: 150,
  segments: 300,
  edgeRadius: 27,
  edgeVariation: 6.5,
  cliffDepth: 46,
  relief: 3.4,
};

export interface TerrainData {
  geometry: BufferGeometry;
  /** Altura del suelo en el centro, donde se planta el Árbol. */
  centerHeight: number;
}

export function buildTerrain(params: TerrainParams = DEFAULT_TERRAIN): TerrainData {
  const noise = makeNoise(params.seed);
  const edgeNoise = makeNoise(params.seed + 977);
  const { size, segments, edgeRadius, edgeVariation, cliffDepth, relief } = params;

  const height = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);

    // Lomas de la meseta, con crestas encima para que no sean dunas.
    const rolling = fbm(noise, x * 0.021, z * 0.021, 5) * relief;
    const rock = (ridged(noise, x * 0.075 + 40, z * 0.075 - 20, 4) - 0.5) * 1.5;
    const detail = fbm(noise, x * 0.32, z * 0.32, 3) * 0.28;

    // El borde entra y sale: sin esto el acantilado sería una circunferencia.
    const wobble =
      edgeNoise(Math.cos(angle) * 1.7, Math.sin(angle) * 1.7) * edgeVariation +
      edgeNoise(Math.cos(angle) * 4.3 + 10, Math.sin(angle) * 4.3 - 5) * (edgeVariation * 0.45);
    const start = edgeRadius + wobble;

    // Caída al vacío. La curva es cúbica: labio suave arriba y pared casi
    // vertical en cuanto se pasa el borde.
    const t = Math.max(0, Math.min(1, (r - start) / 9));
    const fall = t * t * (3 - 2 * t) * cliffDepth * (0.35 + t * 0.65);

    // Una plataforma más llana donde se planta el Árbol.
    const home = Math.max(0, 1 - r / 11);
    const flatten = home * home * 0.75;

    const base = rolling + rock + detail;
    return base * (1 - flatten) + 1.1 * flatten - fall;
  };

  const positions = new Float32Array((segments + 1) * (segments + 1) * 3);
  const uvs = new Float32Array((segments + 1) * (segments + 1) * 2);
  const half = size / 2;
  const step = size / segments;

  let p = 0;
  let t = 0;
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const x = -half + i * step;
      const z = -half + j * step;
      positions[p++] = x;
      positions[p++] = height(x, z);
      positions[p++] = z;
      uvs[t++] = i / segments;
      uvs[t++] = j / segments;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return { geometry, centerHeight: height(0, 0) };
}

/** El terreno de esta historia, calculado una vez al cargar el módulo. */
export const TERRAIN = buildTerrain(DEFAULT_TERRAIN);
