import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import Batch from './ruins/Batch';
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

/**
 * Cuántas piezas se dibujan de las que hay. Las ruinas aguantan mejor el
 * recorte que la hierba —son pocas y cada una cuenta—, así que en calidad
 * baja se quitan solo las últimas.
 */
const shown = (total: number, density: number) =>
  Math.max(1, Math.round(total * Math.min(1, density + 0.45)));

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
      {(
        [
          ['column', RUINS.columns],
          ['brokenColumn', RUINS.brokenColumns],
          ['block', RUINS.blocks],
          ['lintel', RUINS.lintels],
        ] as const
      ).map(([kind, matrices]) => (
        <Batch
          key={kind}
          geometry={PIECES[kind]}
          material={material}
          matrices={matrices}
          count={shown(matrices.length, density)}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
