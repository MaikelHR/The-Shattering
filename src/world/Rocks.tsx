import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import {
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { groundFlatness, groundHeight } from './terrain/heightfield';
import { makeNoise } from './terrain/noise';

/**
 * LAS PIEDRAS
 * ------------------------------------------------------------
 * Tres piedras distintas, repetidas trescientas veces con rotación
 * y tamaño variables. Cada una es un icosaedro cuyos vértices se
 * empujan con ruido: una esfera facetada se lee como dado, y una
 * esfera abollada se lee como piedra.
 *
 * Van sobre todo donde el suelo se inclina, que es donde la erosión
 * las dejaría, y sirven para romper la alfombra de pasto.
 */

const VARIANTS = 3;
const COUNT = 240;
const FIELD_RADIUS = 33;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un icosaedro abollado con ruido: piedra, no dado. */
function rockGeometry(seed: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 2);
  const noise = makeNoise(seed);
  const position = geometry.attributes.position;
  const v = new Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n = v.clone().normalize();
    // Dos escalas de abolladura: bultos grandes y aspereza encima.
    const big = noise(n.x * 1.6 + 10, n.z * 1.6 - 4) * 0.28;
    const small = noise(n.x * 5.5, n.y * 5.5 + n.z * 2.0) * 0.09;
    v.multiplyScalar(1 + big + small);
    // Achatadas: una piedra apoyada es más ancha que alta.
    v.y *= 0.72;
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

interface Scatter {
  matrices: Matrix4[][];
}

function sowRocks(): Scatter {
  const random = mulberry32(9137);
  // Las piedras se juntan en pedreras; repartidas parejo se ven sembradas.
  const fields = makeNoise(7717);
  const matrices: Matrix4[][] = Array.from({ length: VARIANTS }, () => []);

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const euler = new Vector3();

  let attempts = 0;
  while (matrices.flat().length < COUNT && attempts < COUNT * 12) {
    attempts++;
    const r = Math.sqrt(random()) * FIELD_RADIUS;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const flat = groundFlatness(x, z);
    if (flat < 0.55) continue; // en la pared vertical no se apoyan
    // Cuanto más inclinado, más probable: es donde rueda y se acumula.
    if (random() > 1.15 - flat) continue;
    // Y solo donde hay pedrera.
    const field = fields(x * 0.07 + 30, z * 0.07 - 12) * 0.5 + 0.5;
    if (random() > field * field * 1.6) continue;

    const y = groundHeight(x, z);
    if (y < -2) continue;

    const size = 0.2 + Math.pow(random(), 3.0) * 2.6;
    position.set(x, y + size * 0.28, z);
    euler.set(random() * 0.5 - 0.25, random() * Math.PI * 2, random() * 0.5 - 0.25);
    quaternion.setFromAxisAngle(new Vector3(0, 1, 0), euler.y);
    scale.set(size * (0.8 + random() * 0.5), size, size * (0.8 + random() * 0.5));

    const variant = Math.floor(random() * VARIANTS);
    matrices[variant].push(new Matrix4().compose(position, quaternion, scale));
  }

  return { matrices };
}

function RockVariant({
  geometry,
  material,
  matrices,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  matrices: Matrix4[];
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, matrices.length]}
      castShadow
      receiveShadow
    />
  );
}

export default function Rocks() {
  const [rockMap, rockNormal] = useTexture([
    '/textures/dark_rock_diff.webp',
    '/textures/dark_rock_nor.webp',
  ]);

  const scatter = useMemo(sowRocks, []);
  const geometries = useMemo(
    () => Array.from({ length: VARIANTS }, (_, i) => rockGeometry(600 + i * 131)),
    [],
  );

  const material = useMemo(() => {
    for (const map of [rockMap, rockNormal]) {
      map.wrapS = RepeatWrapping;
      map.wrapT = RepeatWrapping;
    }
    rockMap.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({
      map: rockMap,
      normalMap: rockNormal,
      color: '#8d8069',
      roughness: 1,
      metalness: 0,
    });
  }, [rockMap, rockNormal]);

  useEffect(() => {
    return () => {
      material.dispose();
      geometries.forEach((g) => g.dispose());
    };
  }, [material, geometries]);

  return (
    <group>
      {geometries.map((geometry, i) => (
        <RockVariant
          key={i}
          geometry={geometry}
          material={material}
          matrices={scatter.matrices[i]}
        />
      ))}
    </group>
  );
}
