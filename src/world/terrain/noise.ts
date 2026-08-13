// ============================================================
//  RUIDO
// ------------------------------------------------------------
//  Ruido de gradiente 2D con semilla, y su suma en octavas.
//  Es lo que le da forma al terreno: sin esto habría que
//  modelar cada colina a mano, y se notaría.
//
//  No es una librería porque no hace falta: son cuarenta líneas
//  y así el terreno es idéntico en todas las máquinas.
// ============================================================

/** Tabla de permutaciones barajada con la semilla. */
function permutation(seed: number): Uint8Array {
  const p = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i++) source[i] = i;

  // Barajado de Fisher-Yates con un PRNG propio, para no depender de Math.random.
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = source[i & 255];
  return p;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Gradiente 2D: uno de cuatro diagonales según el hash. */
function grad(hash: number, x: number, y: number): number {
  switch (hash & 3) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
}

export interface Noise2D {
  /** Una octava, en el rango -1 a 1 aproximadamente. */
  (x: number, y: number): number;
}

export function makeNoise(seed: number): Noise2D {
  const p = permutation(seed);

  return (x: number, y: number): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];

    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  };
}

/**
 * Suma de octavas: cada una con el doble de frecuencia y la mitad de
 * amplitud. Las primeras dan las montañas y las últimas la aspereza.
 */
export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2.03,
  gain = 0.5,
): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ruido "de cresta": el valor absoluto invertido. Donde el ruido normal
 * hace lomas redondeadas, este hace filos y barrancos, que es lo que
 * distingue una roca de una duna.
 */
export function ridged(noise: Noise2D, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * frequency, y * frequency));
    sum += n * n * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return sum / norm;
}
