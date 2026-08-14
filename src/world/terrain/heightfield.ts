import { BufferGeometry, Float32BufferAttribute } from 'three';
import { fbm, makeNoise, ridged } from './noise';

// ============================================================
//  EL TERRENO
// ------------------------------------------------------------
//  Una llanura que llega hasta el horizonte, con una cordillera
//  al fondo y un barranco cerca del centro.
//
//  La malla no es una cuadrícula sino un abanico de anillos
//  concéntricos, y los radios crecen al cuadrado. Eso pone casi
//  todos los vértices donde está la cámara y deja el horizonte
//  con cuatro, que es exactamente el reparto que hace falta:
//  media unidad de detalle a diez metros y ocho a doscientos.
//  Con una cuadrícula uniforme, cubrir lo mismo costaría un
//  millón de vértices para que el centro se viera igual.
//
//  El horizonte importa más de lo que parece: es lo que da la
//  escala del Árbol. Sin planos intermedios entre el ojo y él,
//  por grande que se lo haga se sigue leyendo como cercano.
// ============================================================

export interface TerrainParams {
  seed: number;
  /** Hasta dónde llega el suelo. Más allá, solo cielo. */
  radius: number;
  /** Anillos concéntricos. */
  rings: number;
  /** Sectores angulares. */
  sectors: number;
  /** Altura de las lomas de la llanura. */
  relief: number;
  /** Dónde empieza a levantarse la cordillera y cuánto sube. */
  mountainStart: number;
  mountainHeight: number;
  /** El barranco: a qué distancia del centro corre (en x), y cuánto baja. */
  canyonX: number;
  canyonDepth: number;
}

export const DEFAULT_TERRAIN: TerrainParams = {
  seed: 8213,
  radius: 290,
  rings: 210,
  sectors: 220,
  relief: 4.2,
  mountainStart: 78,
  mountainHeight: 74,
  canyonX: 47,
  canyonDepth: 30,
};

export interface TerrainData {
  geometry: BufferGeometry;
  /** Altura del suelo en el centro. */
  centerHeight: number;
}

/**
 * La función de altura, aparte de la geometría.
 *
 * La necesitan la hierba, las piedras y las ruinas para sembrarse sobre el
 * suelo: sin esto habría que buscar el vértice más cercano en un array de
 * cuarenta mil, veinte mil veces.
 */
export function makeHeightFunction(params: TerrainParams = DEFAULT_TERRAIN) {
  const noise = makeNoise(params.seed);
  const ridgeNoise = makeNoise(params.seed + 401);
  const mountainNoise = makeNoise(params.seed + 977);
  const { relief, mountainStart, mountainHeight, canyonX, canyonDepth } = params;

  const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  return (x: number, z: number): number => {
    const r = Math.hypot(x, z);

    // Lomas de la llanura, con crestas encima para que no sean dunas.
    const rolling = fbm(noise, x * 0.021, z * 0.021, 5) * relief;
    const rock = (ridged(ridgeNoise, x * 0.075 + 40, z * 0.075 - 20, 4) - 0.5) * 1.6;
    const detail = fbm(noise, x * 0.32, z * 0.32, 3) * 0.26;

    // El barranco. Corre de norte a sur y se cierra por los extremos: es una
    // grieta en el suelo, no una zanja infinita.
    const across = Math.exp(-Math.pow((x - canyonX) / 9, 2));
    const along = Math.exp(-Math.pow(z / 55, 4));
    const canyon = -canyonDepth * across * along;

    // La cordillera, que empieza pasada la llanura y crece hacia el horizonte.
    const ridgeMask = smoothstep(mountainStart, mountainStart + 130, r);
    // Tres capas: la masa general, las crestas grandes y unas menores encima.
    // Sin las crestas, una cordillera se lee como un mar de dunas.
    //
    // Y las crestas llevan su propia amplitud, de frecuencia mucho más baja
    // que ellas. Esto es lo que separa una cordillera de una sierra de
    // juguete: con amplitud constante todas las cumbres salen a la misma
    // altura y el horizonte se lee como el mismo triángulo repetido. Con la
    // máscara hay tramos que se levantan y tramos que se quedan bajos, que
    // es lo que hace una cordillera de verdad.
    const crests =
      0.35 + (fbm(mountainNoise, x * 0.0031 - 55, z * 0.0031 + 21, 2) * 0.5 + 0.5) * 1.05;
    // El ruido de crestas se muestrea a distinta frecuencia en cada eje, y
    // eso las estira: en vez de un campo de conos sueltos salen líneas de
    // cumbres, que es la forma que tiene una cordillera de verdad porque la
    // hace un plegamiento y un plegamiento tiene dirección. Con la misma
    // frecuencia en los dos ejes el horizonte se lee como una fila de
    // triángulos calcados.
    const range =
      (fbm(mountainNoise, x * 0.0075, z * 0.0075, 4) * 0.5 + 0.5) * 0.5 +
      Math.pow(ridged(mountainNoise, x * 0.022 + 9, z * 0.011 - 3, 4), 1.35) * 0.8 * crests +
      Math.pow(ridged(ridgeNoise, x * 0.046 - 17, z * 0.023 + 6, 3), 1.8) * 0.18;
    const mountains = ridgeMask * range * mountainHeight;

    // Un rellano donde se planta lo que importa, para que las ruinas y la
    // hierba no queden en una ladera.
    const home = Math.max(0, 1 - r / 13);
    const flatten = home * home * 0.7;

    const plain = rolling + rock + detail;
    return plain * (1 - flatten) + 0.9 * flatten + canyon + mountains;
  };
}

export function buildTerrain(params: TerrainParams = DEFAULT_TERRAIN): TerrainData {
  const height = makeHeightFunction(params);
  const { radius, rings, sectors } = params;

  // Un vértice central más `rings` anillos de `sectors` vértices.
  const vertexCount = 1 + rings * sectors;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  positions[0] = 0;
  positions[1] = height(0, 0);
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  for (let ring = 0; ring < rings; ring++) {
    // El radio crece al cuadrado: el detalle se concentra cerca del ojo.
    const t = (ring + 1) / rings;
    const r = t * t * radius;

    for (let s = 0; s < sectors; s++) {
      const angle = (s / sectors) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const i = 1 + ring * sectors + s;

      positions[i * 3] = x;
      positions[i * 3 + 1] = height(x, z);
      positions[i * 3 + 2] = z;
      uvs[i * 2] = x / radius;
      uvs[i * 2 + 1] = z / radius;
    }
  }

  const indices: number[] = [];
  // Abanico central.
  for (let s = 0; s < sectors; s++) {
    indices.push(0, 1 + ((s + 1) % sectors), 1 + s);
  }
  // Y un cinturón de quads por cada par de anillos.
  for (let ring = 0; ring < rings - 1; ring++) {
    const inner = 1 + ring * sectors;
    const outer = inner + sectors;
    for (let s = 0; s < sectors; s++) {
      const next = (s + 1) % sectors;
      indices.push(inner + s, outer + next, outer + s);
      indices.push(inner + s, inner + next, outer + next);
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

/** Altura del suelo en cualquier punto, sin tocar la geometría. */
export const groundHeight = makeHeightFunction(DEFAULT_TERRAIN);

/**
 * Pendiente del suelo: 1 en lo llano, 0 en una pared vertical.
 * Sale de dos diferencias finitas, que para sembrar es de sobra.
 */
export function groundFlatness(x: number, z: number, step = 0.6): number {
  const h = groundHeight(x, z);
  const dx = (groundHeight(x + step, z) - h) / step;
  const dz = (groundHeight(x, z + step) - h) / step;
  return 1 / Math.sqrt(1 + dx * dx + dz * dz);
}
