import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { BufferGeometry, InstancedMesh, Matrix4 } from 'three';
import { PIECES } from './ruins/pieces';
import { RUINS } from './ruins/layout';

/**
 * LAS RUINAS
 * ------------------------------------------------------------
 * Columnas, muros y dinteles de lo que fue una capital. Son la
 * única geometría del mundo a la que se le permite ser recta: la
 * hizo alguien, y esa es justamente la lectura que aporta. Sin
 * ruinas, el paisaje es campo; con ruinas, es un imperio caído.
 *
 * Las piezas están talladas en `ruins/pieces.ts` y la disposición
 * en `ruins/layout.ts`. Acá solo se les pone la piedra encima y se
 * vuelcan en cuatro llamadas de dibujo, una por tipo.
 *
 * La piedra tallada va más clara que la roca del terreno: es otro
 * material, traído de otra parte, y el contraste ayuda a leerlas
 * a contraluz.
 */

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

  // Las geometrías no se liberan acá: viven en el módulo y las comparte
  // también la ciudad del cielo. El material sí es nuestro.
  useEffect(() => () => material.dispose(), [material]);

  return (
    <group>
      <Pieces geometry={PIECES.column} material={material} matrices={RUINS.columns} density={density} />
      <Pieces
        geometry={PIECES.brokenColumn}
        material={material}
        matrices={RUINS.brokenColumns}
        density={density}
      />
      <Pieces geometry={PIECES.block} material={material} matrices={RUINS.blocks} density={density} />
      <Pieces geometry={PIECES.lintel} material={material} matrices={RUINS.lintels} density={density} />
    </group>
  );
}
