import { useLayoutEffect, useRef } from 'react';
import type { BufferGeometry, InstancedMesh, Material, Matrix4 } from 'three';

/**
 * UNA TANDA DE PIEZAS IGUALES, en una sola llamada de dibujo.
 *
 * Lo comparten los tres sitios donde alguien construyó algo: las ruinas del
 * suelo, la ciudad que flota y la capital del horizonte. Los tres hacen lo
 * mismo —volcar matrices en un `InstancedMesh` y recalcular la esfera
 * envolvente— y llegó a estar copiado tres veces antes de que valiera la pena
 * sacarlo.
 *
 * `count` va aparte de `matrices.length` a propósito: es la perilla de
 * calidad. `InstancedMesh.count` se puede bajar en caliente sin tocar el
 * buffer, así que en un equipo lento se dibujan menos piezas sin recalcular
 * nada.
 */
export default function Batch({
  geometry,
  material,
  matrices,
  count,
  castShadow = false,
  receiveShadow = false,
}: {
  geometry: BufferGeometry;
  material: Material;
  matrices: Matrix4[];
  count?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [matrices]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (instanced) instanced.count = count ?? matrices.length;
  }, [matrices, count]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
