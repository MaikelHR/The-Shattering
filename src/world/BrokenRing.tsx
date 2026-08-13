import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { scrollState, mapRange, damp } from '../scrollState';

/** Tres arcos de 110° que juntos cierran un anillo. */
const ARC = (Math.PI * 2) / 3 - 0.18;
const SEGMENTS = [0, ARC + 0.18, (ARC + 0.18) * 2];

/**
 * EL ANILLO DE ELDEN, EN EL CIELO
 * ------------------------------------------------------------
 * Está entero al principio y la Fractura lo abre en tres pedazos
 * que se apartan y se desalinean, sin llegar a irse del todo.
 *
 * Son tres arcos y no un torus con un hueco a propósito: la
 * geometría no se puede animar sin recrearla en cada frame, pero
 * mover tres grupos es gratis.
 */
export default function BrokenRing({ reduced }: { reduced: boolean }) {
  const segments = useRef<(Group | null)[]>([]);
  const root = useRef<Group>(null);
  const split = useRef(0);

  useFrame((_, delta) => {
    const target = mapRange(scrollState.position, 0.5, 1.8, 0, 1);
    split.current = damp(split.current, target, 2, delta);

    for (let i = 0; i < SEGMENTS.length; i++) {
      const g = segments.current[i];
      if (!g) continue;
      const dir = SEGMENTS[i] + ARC / 2;
      // Cada pedazo se aparta en la dirección de su propio centro.
      g.position.set(Math.cos(dir) * split.current * 2.2, Math.sin(dir) * split.current * 2.2, 0);
      g.rotation.z = split.current * (i % 2 === 0 ? 0.13 : -0.16);
    }

    if (!reduced && root.current) root.current.rotation.z += delta * 0.008;
  });

  return (
    <group ref={root} position={[0, 14.5, -24]}>
      {SEGMENTS.map((start, i) => (
        <group
          key={i}
          ref={(el) => {
            segments.current[i] = el;
          }}
        >
          <mesh rotation={[0, 0, start]}>
            <torusGeometry args={[8.4, 0.14, 6, 48, ARC]} />
            <meshStandardMaterial
              color="#e8c37a"
              emissive="#e8c37a"
              emissiveIntensity={0.9}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
