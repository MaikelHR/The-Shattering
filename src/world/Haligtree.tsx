import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  PointsMaterial,
} from 'three';
import type { InstancedMesh } from 'three';
import { buildTree } from './erdtree/branches';

/**
 * EL ÁRBOL SAGRADO
 * ------------------------------------------------------------
 * El segundo árbol, el que Miquella plantó lejos y nunca llegó a
 * florecer. Sale del mismo generador que el Áureo, con otros
 * números, y ahí está toda la idea: dos árboles del mismo código
 * que se leen distinto porque la forma la deciden los parámetros.
 *
 * El Áureo se abre en abanico —la copa es más ancha que alta— y es
 * de oro. Este sube estrecho y se queda a media altura: ramas casi
 * verticales, poca apertura y cuatro generaciones de tronco antes
 * de abrirse. Es la silueta de un árbol joven, que es exactamente
 * lo que quedó cuando dejó de crecer.
 *
 * Y es lejano a propósito. A ciento setenta unidades la niebla se
 * come casi la mitad de su color: se lee como una promesa que se
 * ve desde acá y a la que no se llega, que es lo que era.
 */

const HALIGTREE = buildTree({
  seed: 77021,
  // Once generaciones y un tronco fino. Con menos, las ramas salen gordas y
  // pocas y el árbol se lee como un candelabro: seis brazos con un pompón en
  // la punta. La copa necesita ramitas para verse copa.
  levels: 11,
  trunkLength: 2.4,
  trunkRadius: 0.8,
  lengthFalloff: 0.8,
  radiusFalloff: 0.66,
  // Apenas se abre y empuja hacia arriba: de acá sale la aguja.
  spreadMin: 0.18,
  spreadMax: 0.4,
  upBias: 0.34,
  tripleChance: 0.3,
  // Cinco generaciones de tronco: sube derecho mucho antes de abrirse.
  trunkLevels: 5,
});

/** Al suroeste, sobre la cordillera, con la base hundida en la roca. */
const POSITION: [number, number, number] = [-135, 38, 78];
const SCALE = 3.5;

export default function Haligtree() {
  const branches = useRef<InstancedMesh>(null);

  const bark = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#9aa596',
        // Verde pálido y frío en vez de oro: es el mismo tipo de luz, pero
        // esta nunca llegó a encenderse del todo. Y con la emisión baja: si
        // brilla más que el Árbol Áureo deja de ser el que no floreció.
        emissive: '#c2d6ac',
        emissiveIntensity: 0.2,
        roughness: 0.7,
        metalness: 0,
        flatShading: true,
      }),
    [],
  );

  const foliage = useMemo(
    () =>
      new PointsMaterial({
        color: '#cfe0b8',
        // Tamaño en unidades del mundo, no en píxeles: así se achica con la
        // distancia como se achica todo lo demás. Y chico: el grupo va a
        // escala tres y medio, así que esto son un metro y medio de mundo.
        size: 0.42,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  const leaves = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(HALIGTREE.tips.length * 3);
    HALIGTREE.tips.forEach((tip, i) => {
      positions[i * 3] = tip.x;
      positions[i * 3 + 1] = tip.y;
      positions[i * 3 + 2] = tip.z;
    });
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(
    () => () => {
      bark.dispose();
      foliage.dispose();
      leaves.dispose();
    },
    [bark, foliage, leaves],
  );

  useLayoutEffect(() => {
    const mesh = branches.current;
    if (!mesh) return;
    HALIGTREE.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  return (
    <group position={POSITION} scale={SCALE}>
      {/* Sin sombras: queda fuera del volumen que cubre el mapa de sombra de
          la direccional, así que pedirlas sería pagar por nada. */}
      <instancedMesh
        ref={branches}
        args={[undefined, undefined, HALIGTREE.matrices.length]}
        material={bark}
      >
        <cylinderGeometry args={[0.5, 0.62, 1, 5, 1]} />
      </instancedMesh>

      <points geometry={leaves} material={foliage} />
    </group>
  );
}
