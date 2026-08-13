import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import type { Group } from 'three';
import { scrollState, mapRange } from '../scrollState';

interface IslandDef {
  base: [number, number, number];
  radius: number;
  height: number;
  seg: number;
  drift: number;
  phase: number;
}

// Las Tierras Intermedias: la meseta de la capital, con el Árbol encima,
// y seis mesetas alrededor que la Fractura va apartando del centro.
const ISLANDS: IslandDef[] = [
  { base: [0, 0, 0], radius: 3.4, height: 1.4, seg: 8, drift: 0.15, phase: 0.0 },
  { base: [6.0, 1.2, -2.6], radius: 1.5, height: 0.9, seg: 6, drift: 0.3, phase: 1.2 },
  { base: [-5.4, 1.9, -1.4], radius: 1.2, height: 0.8, seg: 7, drift: 0.35, phase: 2.4 },
  { base: [3.8, -2.2, 3.4], radius: 1.05, height: 0.65, seg: 6, drift: 0.4, phase: 3.1 },
  { base: [-4.3, -2.6, 2.8], radius: 1.3, height: 0.85, seg: 7, drift: 0.28, phase: 4.0 },
  { base: [2.0, 3.0, 4.6], radius: 0.9, height: 0.55, seg: 5, drift: 0.45, phase: 5.2 },
  { base: [-1.6, -3.8, -4.0], radius: 1.0, height: 0.6, seg: 6, drift: 0.38, phase: 0.6 },
];

/** Solo la geometría: el movimiento lo maneja el bucle de arriba. */
function Island({ def, isMother }: { def: IslandDef; isMother: boolean }) {
  return (
    <>
      {/* Meseta superior */}
      <mesh>
        <cylinderGeometry args={[def.radius, def.radius * 0.92, def.height, def.seg, 1]} />
        <meshStandardMaterial color="#5a4c37" roughness={0.92} metalness={0.05} flatShading />
      </mesh>
      {/* Raíz de roca que cuelga */}
      <mesh position={[0, -def.height * 1.6, 0]}>
        <coneGeometry args={[def.radius * 0.88, def.height * 2.6, def.seg, 1]} />
        <meshStandardMaterial color="#33291b" roughness={1} metalness={0} flatShading />
      </mesh>
      {/* Borde superior, donde pega la luz del Árbol. openEnded (el último
          argumento) es lo que lo hace un aro y no una tapa: con las caras
          cerradas, la meseta entera quedaba de un dorado plano y la roca no
          se veía nunca desde arriba. */}
      <mesh position={[0, def.height / 2 - 0.02, 0]}>
        <cylinderGeometry
          args={[def.radius * 1.008, def.radius * 1.008, 0.09, def.seg, 1, true]}
        />
        <meshStandardMaterial
          color="#e8c37a"
          emissive="#e8c37a"
          emissiveIntensity={isMother ? 0.85 : 0.45}
          side={DoubleSide} // el aro es una pared sin tapas: se mira por los dos lados
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

/**
 * El cúmulo entero se anima en un solo useFrame.
 *
 * Antes cada isla tenía el suyo y recalculaba `spread` y `settle` por su
 * cuenta: siete veces el mismo número, siete suscripciones al bucle. Acá
 * se calculan una vez por frame y se reparten.
 *
 * Con movimiento reducido las islas dejan de flotar y de girar solas,
 * pero siguen separándose con el scroll: eso lo maneja el usuario.
 */
export default function Islands({ reduced }: { reduced: boolean }) {
  const groups = useRef<(Group | null)[]>([]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Reacción al scroll: las mesetas se apartan del centro con la
    // Fractura (capítulo II) y se asientan un poco hacia el final.
    const spread = mapRange(scrollState.position, 0.6, 2.2, 1, 1.45);
    const settle = mapRange(scrollState.position, 3.2, 4, 0, 1);
    const factor = spread - settle * 0.25;

    for (let i = 0; i < ISLANDS.length; i++) {
      const g = groups.current[i];
      if (!g) continue;

      const def = ISLANDS[i];
      const isMother = i === 0;
      const [bx, by, bz] = def.base;

      // Deriva ambiental: cada isla flota a su propio ritmo.
      const bob = reduced ? 0 : Math.sin(t * def.drift + def.phase) * (isMother ? 0.12 : 0.3);
      const f = isMother ? 1 : factor;

      g.position.set(bx * f, by * f + bob, bz * f);
      if (!isMother && !reduced) g.rotation.y += delta * def.drift * 0.35;
    }
  });

  return (
    <group>
      {ISLANDS.map((def, i) => (
        <group
          key={i}
          position={def.base}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <Island def={def} isMother={i === 0} />
        </group>
      ))}
    </group>
  );
}
