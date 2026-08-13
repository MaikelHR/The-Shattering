import { Matrix4, Quaternion, Vector3 } from 'three';

// ============================================================
//  EL ÁRBOL, GENERADO
// ------------------------------------------------------------
//  El Árbol Áureo no es un modelo: se calcula. Una rama se parte
//  en dos o tres hijas más cortas y más finas, y esas hacen lo
//  mismo, ocho veces. De ahí salen unas dos mil ramas.
//
//  Todas viven en un solo InstancedMesh, así que las dos mil son
//  una sola llamada de dibujo. La cuenta se hace una vez al
//  montar (unos pocos milisegundos) y no se repite nunca.
//
//  El azar va con semilla fija: el Árbol es siempre el mismo.
//  Cambiar la semilla es cambiar de árbol, y eso es una perilla,
//  no un accidente.
// ============================================================

export interface TreeParams {
  seed: number;
  /** Cuántas veces se subdivide. Cada nivel más, casi el doble de ramas. */
  levels: number;
  /** Largo y radio del tronco. */
  trunkLength: number;
  trunkRadius: number;
  /** Cuánto encoge cada generación. */
  lengthFalloff: number;
  radiusFalloff: number;
  /** Apertura de las hijas respecto de la madre, en radianes. */
  spreadMin: number;
  spreadMax: number;
  /** Cuánto se enderezan las hijas. Sin esto la copa se desparrama a lo ancho. */
  upBias: number;
  /** Probabilidad de que una rama se abra en tres en vez de en dos. */
  tripleChance: number;
}

export const DEFAULT_TREE: TreeParams = {
  seed: 20260813,
  levels: 8,
  trunkLength: 3.4,
  trunkRadius: 0.82,
  lengthFalloff: 0.76,
  radiusFalloff: 0.66,
  spreadMin: 0.26,
  spreadMax: 0.62,
  upBias: 0.11,
  tripleChance: 0.5,
};

export interface TreeGeometryData {
  /** Una matriz por rama, lista para InstancedMesh. */
  matrices: Matrix4[];
  /** Cuánto brilla cada rama: 0 en el tronco, 1 en las puntas. */
  glow: Float32Array;
  /** Dónde termina cada rama de los dos últimos niveles: ahí van las hojas. */
  tips: Vector3[];
  /** Altura del punto más alto, para colocar la luz y la cámara. */
  height: number;
}

/** PRNG diminuto con semilla. Mismo número de entrada, mismo árbol. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new Vector3(0, 1, 0);

/** Un vector cualquiera perpendicular a `dir`, para abrir las hijas alrededor. */
function perpendicular(dir: Vector3, out: Vector3): Vector3 {
  out.set(1, 0, 0);
  if (Math.abs(dir.x) > 0.9) out.set(0, 0, 1);
  return out.cross(dir).normalize();
}

export function buildTree(params: TreeParams = DEFAULT_TREE): TreeGeometryData {
  const random = mulberry32(params.seed);
  const matrices: Matrix4[] = [];
  const glowValues: number[] = [];
  const tips: Vector3[] = [];
  let height = 0;

  // Reutilizables: generar dos mil ramas creando objetos nuevos en cada una
  // llena el recolector de basura sin necesidad.
  const quat = new Quaternion();
  const axis = new Vector3();
  const scale = new Vector3();
  const mid = new Vector3();

  const grow = (base: Vector3, dir: Vector3, length: number, radius: number, level: number) => {
    const end = base.clone().addScaledVector(dir, length);
    height = Math.max(height, end.y);

    // El cilindro base mide una unidad y está centrado: se lleva al medio de la
    // rama, se gira desde el eje Y hasta la dirección y se estira.
    mid.copy(base).add(end).multiplyScalar(0.5);
    quat.setFromUnitVectors(UP, dir);
    scale.set(radius, length, radius);

    matrices.push(new Matrix4().compose(mid, quat, scale));
    glowValues.push(level / params.levels);

    if (level >= params.levels) {
      tips.push(end);
      return;
    }
    if (level >= params.levels - 2) tips.push(end);

    // Dos hijas casi siempre, tres de vez en cuando: con un número fijo el
    // árbol se ve tejido a máquina.
    const children = random() < params.tripleChance ? 3 : 2;
    const roll = random() * Math.PI * 2;

    for (let i = 0; i < children; i++) {
      // Los dos primeros niveles apenas se abren: así hay un tronco que sube
      // antes de que empiece el ramaje. Sin esto el Árbol se bifurca a ras de
      // la meseta y se desmorona hacia un lado.
      const opening = level < 2 ? 0.42 : 1;
      const spread =
        (params.spreadMin + random() * (params.spreadMax - params.spreadMin)) * opening;
      const around = roll + (i / children) * Math.PI * 2 + (random() - 0.5) * 0.5;

      perpendicular(dir, axis).applyAxisAngle(dir, around);
      const childDir = dir.clone().applyAxisAngle(axis, spread);

      // Un empujón hacia arriba para que la copa suba en vez de desparramarse.
      childDir.y += params.upBias;
      childDir.normalize();

      grow(
        end,
        childDir,
        length * params.lengthFalloff * (0.9 + random() * 0.2),
        radius * params.radiusFalloff,
        level + 1,
      );
    }
  };

  grow(new Vector3(0, 0, 0), UP.clone(), params.trunkLength, params.trunkRadius, 0);

  return { matrices, glow: new Float32Array(glowValues), tips, height };
}

/**
 * El Árbol de esta historia, calculado una sola vez al cargar el módulo.
 * Lo comparten la escena (que lo dibuja) y World (que necesita su altura
 * para colocar la luz y el emisor de los rayos).
 */
export const TREE = buildTree(DEFAULT_TREE);
