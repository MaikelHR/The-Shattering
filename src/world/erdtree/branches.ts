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
  /**
   * Cuántas generaciones mantienen un eje central grueso del que salen ramas
   * laterales, en vez de partirse en dos iguales. Es lo que separa un árbol
   * viejo de uno joven: el tronco sube entero y la copa se abre arriba.
   */
  trunkLevels: number;
  /**
   * Cuánto se dobla cada rama **a lo largo de sí misma**, en radianes. Cero
   * —lo normal— deja los tramos rectos, que es lo que quiere una rama: una
   * rama busca la luz y va a por ella.
   *
   * Una raíz no. Una raíz va rodeando lo que se encuentra, y por eso se lee
   * curva. Sin esto, las raíces salían varillas rectas con codos duros: la
   * silueta delataba que las tres cosas del proyecto —el Árbol, el otro árbol
   * y las raíces— salen del mismo sitio, cuando la gracia era justo que no se
   * notara.
   */
  bend?: number;
  /**
   * En cuántos cilindros se parte cada rama para poder doblarse. Solo se usa
   * si `bend` no es cero, y multiplica la cuenta de ramas por este número.
   */
  bendSteps?: number;
  /**
   * Cuánto se afina cada rama a lo largo de sí misma, de 0 a 1. Lo normal es
   * cero: el afinado ocurre entre generaciones y ya. Una raíz gorda que
   * termina en un pelo necesita además afinarse por dentro del tramo.
   */
  taperAlong?: number;
  /**
   * Cuánto conserva el tronco de su grosor en cada generación. Por debajo de
   * 0,9 el eje se afina rápido, que es lo que hace una raíz y no un cable.
   */
  trunkTaper?: number;
}

export const DEFAULT_TREE: TreeParams = {
  seed: 20260813,
  levels: 11,
  trunkLength: 3.2,
  trunkRadius: 1.5,
  lengthFalloff: 0.79,
  radiusFalloff: 0.66,
  spreadMin: 0.34,
  spreadMax: 0.78,
  upBias: 0.04,
  tripleChance: 0.5,
  trunkLevels: 4,
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

  const bend = params.bend ?? 0;
  const steps = bend > 0 ? Math.max(2, params.bendSteps ?? 4) : 1;
  const taperAlong = params.taperAlong ?? 0;
  const trunkTaper = params.trunkTaper ?? 0.9;

  const grow = (base: Vector3, dir: Vector3, length: number, radius: number, level: number) => {
    const end = base.clone();
    // Dónde APUNTA la rama al terminar. Con tramos rectos es la dirección de
    // siempre; con tramos curvos no, y de ahí tienen que salir los hijos: si
    // salieran de la dirección inicial, la curva se rompería en cada nudo y
    // volverían los codos que se querían quitar.
    const outDir = dir.clone();

    if (steps === 1) {
      end.addScaledVector(dir, length);

      // El cilindro base mide una unidad y está centrado: se lleva al medio de
      // la rama, se gira desde el eje Y hasta la dirección y se estira.
      mid.copy(base).add(end).multiplyScalar(0.5);
      quat.setFromUnitVectors(UP, dir);
      scale.set(radius, length, radius);

      matrices.push(new Matrix4().compose(mid, quat, scale));
      glowValues.push(level / params.levels);
    } else {
      // Una rama doblada es una cadena de cilindros cortos que giran siempre
      // hacia el mismo lado. El eje de giro se sortea una vez por rama y no
      // una por tramo: cambiándolo en cada paso sale un zigzag, no un arco.
      perpendicular(dir, axis).applyAxisAngle(dir, random() * Math.PI * 2);
      const bendAxis = axis.clone();
      const perStep = (bend / steps) * (0.5 + random());
      const stepLength = length / steps;
      const from = base.clone();

      for (let s = 0; s < steps; s++) {
        const along = (s + 0.5) / steps;
        const r = radius * (1 - taperAlong * along);

        end.copy(from).addScaledVector(outDir, stepLength);
        mid.copy(from).add(end).multiplyScalar(0.5);
        quat.setFromUnitVectors(UP, outDir);
        // Un dos por ciento de más en el largo: sin ese solape se ve la junta
        // entre cilindro y cilindro cada vez que la cadena dobla.
        scale.set(r, stepLength * 1.02, r);

        matrices.push(new Matrix4().compose(mid, quat, scale));
        // El brillo también avanza dentro de la rama, no solo entre
        // generaciones: es lo que convierte el degradado en continuo en vez
        // de en bandas de un tramo entero cada una.
        glowValues.push((level + (s + 1) / steps) / params.levels);

        from.copy(end);
        outDir.applyAxisAngle(bendAxis, perStep).normalize();
      }
    }

    height = Math.max(height, end.y);

    if (level >= params.levels) {
      tips.push(end);
      return;
    }
    if (level >= params.levels - 2) tips.push(end);

    // A partir de acá, `dir` es la dirección de SALIDA de la rama.
    dir = outDir;
    const roll = random() * Math.PI * 2;

    // ---- Tramo de tronco ----
    // Mientras dura, la rama no se parte en iguales: sigue de largo, apenas
    // más fina, y suelta ramas laterales mucho más delgadas. Un árbol que se
    // bifurca en dos desde abajo es un arbusto grande, por muy alto que sea.
    if (level < params.trunkLevels) {
      // El eje sigue subiendo, casi vertical y casi con el mismo grosor.
      const trunkDir = dir.clone();
      trunkDir.y += 0.16;
      perpendicular(dir, axis).applyAxisAngle(dir, roll);
      trunkDir.applyAxisAngle(axis, 0.07 + random() * 0.06).normalize();

      grow(
        end,
        trunkDir,
        length * (0.86 + random() * 0.08),
        radius * (trunkTaper - level * 0.015),
        level + 1,
      );

      // Y una o dos ramas maestras, que salen abiertas y bastante más finas.
      const limbs = level === 0 ? 1 : 1 + (random() < 0.5 ? 1 : 0);
      for (let i = 0; i < limbs; i++) {
        const around = roll + Math.PI * (0.6 + i) + (random() - 0.5) * 0.8;
        perpendicular(dir, axis).applyAxisAngle(dir, around);
        // Bien abiertas y bien largas: son ellas las que dan el vuelo de la
        // copa. Cortas y empinadas, el Árbol sale con forma de álamo.
        const limbDir = dir.clone().applyAxisAngle(axis, 0.85 + random() * 0.35);
        limbDir.y += 0.06;
        limbDir.normalize();

        grow(
          end,
          limbDir,
          length * (0.82 + random() * 0.22),
          radius * (0.42 + random() * 0.1),
          // Las ramas maestras ya no son tronco: pasan al régimen de copa.
          Math.max(params.trunkLevels, level + 1),
        );
      }
      return;
    }

    // ---- Copa ----
    // Dos hijas casi siempre, tres de vez en cuando: con un número fijo el
    // árbol se ve tejido a máquina.
    const children = random() < params.tripleChance ? 3 : 2;

    for (let i = 0; i < children; i++) {
      const spread = params.spreadMin + random() * (params.spreadMax - params.spreadMin);
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
        // Regla de Leonardo: la sección de la madre se reparte entre las
        // hijas, así que el radio se divide por la raíz de cuántas son. Es
        // lo que hace que el afinado se vea natural y no impuesto.
        (radius / Math.sqrt(children)) * (0.94 + random() * 0.1),
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

/**
 * DÓNDE ESTÁ Y CUÁNTO MIDE
 * ------------------------------------------------------------
 * El Árbol Áureo se ve desde toda la región y las murallas de la capital
 * son enanas a su lado. Eso no se consigue solo agrandándolo: un objeto
 * enorme y cercano se lee como un objeto normal. La escala sale de la
 * distancia, de tener planos intermedios delante y de que la bruma se
 * coma la base.
 *
 * Así que el Árbol vive lejos, en la cordillera del norte, y mide seis
 * veces y media lo que medía cuando estaba plantado en el patio.
 */
export const TREE_SCALE = 6.4;
export const TREE_POSITION: [number, number, number] = [6, 24, -178];

/** Altura real del Árbol en el mundo, ya escalada. */
export const TREE_WORLD_HEIGHT = TREE.height * TREE_SCALE;
