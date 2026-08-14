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
 * El Áureo es de oro, arde en las puntas y mide ciento veinte
 * unidades. Este es pálido y frío, no llega a la mitad de alto, y
 * su copa es más cerrada. Lo que NO es, aunque lo fue durante una
 * versión, es un palo con cuatro pompones arriba: un árbol que se
 * quedó a medias sigue siendo un árbol, con su copa repartida.
 *
 * Y es lejano a propósito. A ciento setenta unidades la niebla se
 * come casi la mitad de su color: se lee como una promesa que se
 * ve desde acá y a la que no se llega, que es lo que era.
 */

/**
 * La forma sale de medirla contra el Áureo, que es el que se ve bien.
 *
 * La versión anterior tenía el **42% de la altura en tronco pelado** —cinco
 * generaciones de tronco antes de abrirse— contra el 16% del Áureo, y la copa
 * le quedaba en cuatro pompones arriba del palo. Bajando a tres generaciones
 * de tronco y abriendo el ángulo, el tronco pelado cae al 21% y la copa pasa a
 * ocupar el resto.
 *
 * Y son dos mil ramas y no seis mil como el Áureo, a propósito: este mide la
 * mitad y se ve a la misma distancia, así que con la mitad de tamaño angular
 * la misma cuenta se vería el doble de densa.
 */
const HALIGTREE = buildTree({
  seed: 77021,
  levels: 9,
  trunkLength: 2.6,
  trunkRadius: 0.9,
  lengthFalloff: 0.8,
  radiusFalloff: 0.66,
  spreadMin: 0.3,
  spreadMax: 0.66,
  upBias: 0.16,
  tripleChance: 0.5,
  trunkLevels: 3,
});

/** Al suroeste, sobre la cordillera, con la base hundida en la roca. */
const POSITION: [number, number, number] = [-135, 38, 78];
const SCALE = 3.85;

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
        emissiveIntensity: 0.3,
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
        // distancia como se achica todo lo demás.
        //
        // Y muy chico. Era tres veces más grande, y ese era el otro motivo
        // del brócoli: dos mil motas de metro y medio en una copa de
        // cincuenta se solapan hasta formar bolas. Pequeñas y translúcidas
        // hacen brillo, y la silueta la lleva el ramaje, que es lo que hay
        // que ver.
        size: 0.14,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.34,
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
