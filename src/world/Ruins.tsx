import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import {
  BoxGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { BufferGeometry, InstancedMesh, Matrix4 } from 'three';
import { makeNoise } from './terrain/noise';
import { RUINS } from './ruins/layout';

/**
 * LAS RUINAS
 * ------------------------------------------------------------
 * Columnas, muros y dinteles de lo que fue una capital. Son la
 * única geometría del mundo a la que se le permite ser recta: la
 * hizo alguien, y esa es justamente la lectura que aporta. Sin
 * ruinas, el paisaje es campo; con ruinas, es un imperio caído.
 *
 * Lo que las hace creíbles no es la forma sino el desgaste. Cada
 * pieza lleva los bordes comidos por ruido y las columnas rotas
 * terminan en un filo irregular, nunca en un corte limpio.
 *
 * La piedra tallada va más clara que la roca del terreno: es otro
 * material, traído de otra parte, y el contraste ayuda a leerlas
 * a contraluz.
 */

/** Erosiona una geometría empujando sus vértices con ruido. */
function weather(geometry: BufferGeometry, seed: number, amount: number): BufferGeometry {
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
function columnGeometry(seed: number, broken: boolean): BufferGeometry {
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

function blockGeometry(seed: number): BufferGeometry {
  return weather(new BoxGeometry(1, 1, 1, 4, 4, 4), seed, 0.11);
}

function lintelGeometry(seed: number): BufferGeometry {
  return weather(new BoxGeometry(1, 1, 1, 8, 3, 3), seed, 0.06);
}

function Pieces({
  geometry,
  material,
  matrices,
  density,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  matrices: Matrix4[];
  density: number;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [matrices]);

  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    // Las ruinas aguantan mejor el recorte que la hierba: son pocas piezas y
    // cada una cuenta, así que en calidad baja se quitan solo las últimas.
    instanced.count = Math.max(1, Math.round(matrices.length * Math.min(1, density + 0.45)));
  }, [matrices, density]);

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

export default function Ruins({ density }: { density: number }) {
  const [rockMap, rockNormal] = useTexture([
    '/textures/dark_rock_diff.webp',
    '/textures/dark_rock_nor.webp',
  ]);

  const geometries = useMemo(
    () => ({
      column: columnGeometry(311, false),
      brokenColumn: columnGeometry(733, true),
      block: blockGeometry(1201),
      lintel: lintelGeometry(1607),
    }),
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
      color: '#c4b394',
      roughness: 0.92,
      metalness: 0,
    });
  }, [rockMap, rockNormal]);

  useEffect(() => {
    return () => {
      material.dispose();
      Object.values(geometries).forEach((g) => g.dispose());
    };
  }, [material, geometries]);

  return (
    <group>
      <Pieces geometry={geometries.column} material={material} matrices={RUINS.columns} density={density} />
      <Pieces
        geometry={geometries.brokenColumn}
        material={material}
        matrices={RUINS.brokenColumns}
        density={density}
      />
      <Pieces geometry={geometries.block} material={material} matrices={RUINS.blocks} density={density} />
      <Pieces geometry={geometries.lintel} material={material} matrices={RUINS.lintels} density={density} />
    </group>
  );
}
