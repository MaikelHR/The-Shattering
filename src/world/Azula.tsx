import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Group, InstancedMesh } from 'three';
import { PIECES } from './ruins/pieces';

/**
 * FARUM AZULA
 * ------------------------------------------------------------
 * La ciudad que lleva mil años cayéndose y todavía no toca el
 * suelo. Está hecha con las mismas piezas que las ruinas del
 * suelo —la misma cantería, compartida— pero dispuesta al revés:
 * en vez de columnas hincadas en la tierra, losas rotas que se
 * separan una de otra mientras bajan.
 *
 * Dos decisiones que la sostienen:
 *
 *  - No lleva texturas. Vive a ciento sesenta unidades y la
 *    niebla se come la mitad de su color: a esa distancia un mapa
 *    de piedra no aporta un solo píxel y cuesta lo mismo que
 *    cerca. Lo único que llega es la silueta.
 *
 *  - Gira muy despacio, y solo eso. En el juego la tormenta no
 *    termina nunca; acá alcanza con que las losas no estén
 *    quietas para que se lea que están cayendo. Si girara lo
 *    suficiente como para notarlo, se leería como un carrusel.
 */

/**
 * Al sur y bien arriba, en el trozo de cielo al que la historia casi no
 * mira. Eso es deliberado: la ciudad no está en cuadro en ningún capítulo
 * salvo el suyo —y de refilón desde el fondo del barranco, que es justo el
 * anterior—, así que el VI descubre algo en vez de señalar algo que ya
 * llevaba media página ahí.
 */
const POSITION: [number, number, number] = [30, 115, 175];

/** PRNG con semilla: la ciudad se rompe siempre por los mismos sitios. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CityLayout {
  columns: Matrix4[];
  brokenColumns: Matrix4[];
  blocks: Matrix4[];
  lintels: Matrix4[];
}

/**
 * Las islas de la ciudad. Cada una es una masa de roca con una losa
 * pavimentada encima: sin la masa, una losa suelta se lee como una tabla
 * flotando, y lo que tiene que leerse es un trozo de mundo arrancado.
 *
 * La de arriba es la que todavía tiene edificios; las de abajo se fueron
 * soltando y van quedando atrás, cada vez más chicas y más torcidas. Esa
 * fuga es lo que dice "esto se está cayendo" sin que nada se mueva.
 */
const ISLES = [
  { x: 0, y: 0, z: 0, w: 30, d: 24, tilt: 0.03, spin: 0.2, built: true },
  { x: -24, y: -7, z: 10, w: 18, d: 15, tilt: 0.13, spin: -0.7, built: false },
  { x: 22, y: -12, z: -14, w: 15, d: 13, tilt: -0.17, spin: 1.4, built: false },
  { x: 5, y: -22, z: 16, w: 11, d: 10, tilt: 0.24, spin: 2.6, built: false },
  { x: -14, y: -30, z: -7, w: 8, d: 7, tilt: -0.3, spin: 0.9, built: false },
];

function buildCity(seed = 9137): CityLayout {
  const random = mulberry32(seed);
  const out: CityLayout = { columns: [], brokenColumns: [], blocks: [], lintels: [] };

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();

  const put = (
    list: Matrix4[],
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx: number,
    ry: number,
    rz: number,
  ) => {
    position.set(x, y, z);
    euler.set(rx, ry, rz);
    quaternion.setFromEuler(euler);
    scale.set(sx, sy, sz);
    list.push(new Matrix4().compose(position, quaternion, scale));
  };

  for (const isle of ISLES) {
    // El pavimento, fino, y la roca de debajo, gorda y algo más chica: así
    // el canto de la isla se ve como un corte y no como el borde de un plato.
    put(out.blocks, isle.x, isle.y, isle.z, isle.w, 2.4, isle.d, isle.tilt, isle.spin, isle.tilt * 0.6);
    put(
      out.blocks,
      isle.x, isle.y - isle.w * 0.22, isle.z,
      isle.w * 0.86, isle.w * 0.4, isle.d * 0.84,
      isle.tilt, isle.spin + 0.3, isle.tilt * 0.6,
    );
  }

  // Lo que queda en pie sobre la isla mayor. A ciento noventa unidades un
  // grado son más de tres unidades de mundo: lo que no llega a diez no se
  // ve. Por eso acá no hay escombro fino, hay torres.
  const top = ISLES[0].y + 1.2;
  const TOWERS = [
    { x: -9, z: -5, w: 4.2, h: 17 },
    { x: -2, z: 4, w: 3.4, h: 12 },
    { x: 6, z: -6, w: 5, h: 21 },
    { x: 12, z: 3, w: 3.6, h: 14 },
  ];
  for (const t of TOWERS) {
    // Se estrechan hacia arriba en dos tramos y el remate va torcido: una
    // torre partida a media altura, no un prisma.
    put(out.blocks, t.x, top + t.h * 0.3, t.z, t.w, t.h * 0.6, t.w, 0.01, random() * 3, 0.015);
    put(
      out.blocks,
      t.x + (random() - 0.5) * 0.8, top + t.h * 0.78, t.z + (random() - 0.5) * 0.8,
      t.w * 0.66, t.h * 0.36, t.w * 0.66,
      (random() - 0.5) * 0.12, random() * 3, (random() - 0.5) * 0.12,
    );
  }

  // Una hilera de columnas delante de las torres, que es lo que dice que
  // aquello lo levantó alguien.
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 4.2 + (random() - 0.5) * 0.6;
    const z = 9 + (random() - 0.5) * 1.4;
    const broken = random() > 0.55;
    const height = broken ? 4 + random() * 3 : 8 + random() * 3.5;
    put(
      out[broken ? 'brokenColumns' : 'columns'],
      x, top + height / 2, z,
      1.5, height, 1.5,
      (random() - 0.5) * 0.08, random() * 3, (random() - 0.5) * 0.08,
    );
  }

  // Un arco entero en el borde: dos patas y su dintel.
  const archHeight = 11;
  for (const dx of [-3, 3]) {
    put(out.columns, -14 + dx, top + archHeight / 2, 4, 1.7, archHeight, 1.7, 0, 0.4, 0);
  }
  put(out.lintels, -14, top + archHeight + 0.6, 4, 10, 1.6, 2.2, 0, 0.4, 0.03);

  // Y unos pocos bloques grandes desprendiéndose entre isla e isla. Pocos y
  // gordos: muchos y chicos se leen como una nube de cubos.
  for (let i = 0; i < 11; i++) {
    const size = 2.2 + random() * 3.4;
    put(
      out.blocks,
      (random() - 0.5) * 56,
      -random() * 40 + 4,
      (random() - 0.5) * 46,
      size,
      size * (0.4 + random() * 0.5),
      size * (0.7 + random() * 0.6),
      random() * 3,
      random() * 3,
      random() * 3,
    );
  }

  return out;
}

const CITY = buildCity();

function Pieces({
  geometry,
  material,
  matrices,
  count,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  matrices: Matrix4[];
  count: number;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.count = count;
    instanced.computeBoundingSphere();
  }, [matrices, count]);

  if (matrices.length === 0) return null;

  return <instancedMesh ref={mesh} args={[geometry, material, matrices.length]} />;
}

export default function Azula({ reduced, density }: { reduced: boolean; density: number }) {
  const group = useRef<Group>(null);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        // Mucho más oscura que la piedra del suelo. No es un capricho de
        // paleta: a doscientas cuarenta unidades la niebla ya aporta el
        // setenta por ciento del color, así que con una piedra clara la
        // ciudad sale más brillante que el cielo y se pega al ojo como un
        // recorte. Oscura, la niebla la levanta hasta quedar justo por
        // encima del fondo, que es como se ve algo lejano de verdad.
        color: '#3e4541',
        roughness: 0.95,
        metalness: 0,
        flatShading: true,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    if (reduced || !group.current) return;
    group.current.rotation.y += delta * 0.006;
  });

  // En calidad baja se van los bloques sueltos, que están al final del
  // array y son los que menos se echan de menos: las islas y las torres,
  // que son la silueta, se dibujan siempre.
  const solid = ISLES.length * 2 + 8;
  const rubble = Math.max(solid, Math.round(CITY.blocks.length * Math.min(1, density + 0.3)));

  return (
    <group ref={group} position={POSITION} scale={1.5}>
      <Pieces
        geometry={PIECES.column}
        material={material}
        matrices={CITY.columns}
        count={CITY.columns.length}
      />
      <Pieces
        geometry={PIECES.brokenColumn}
        material={material}
        matrices={CITY.brokenColumns}
        count={CITY.brokenColumns.length}
      />
      <Pieces geometry={PIECES.block} material={material} matrices={CITY.blocks} count={rubble} />
      <Pieces
        geometry={PIECES.lintel}
        material={material}
        matrices={CITY.lintels}
        count={CITY.lintels.length}
      />
    </group>
  );
}
