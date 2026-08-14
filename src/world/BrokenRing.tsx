import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { scrollState, damp, clamp } from '../scrollState';
import { ringSplit, shock } from './mood';

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
    split.current = damp(split.current, ringSplit(scrollState.position), 2, delta);

    // El empujón del golpe. Va SIN suavizar y sumado a la apertura: los tres
    // pedazos salen disparados en el instante de la Fractura y después se
    // recogen a la separación que les toca. Sin esto el Anillo se abre como
    // una puerta, y lo que tiene que hacer es reventar.
    const kick = clamp(shock.value, 0, 1);
    const open = split.current + kick * 0.55;

    for (let i = 0; i < SEGMENTS.length; i++) {
      const g = segments.current[i];
      if (!g) continue;
      const dir = SEGMENTS[i] + ARC / 2;
      // Cada pedazo se aparta en la dirección de su propio centro.
      g.position.set(Math.cos(dir) * open * 2.2, Math.sin(dir) * open * 2.2, 0);
      g.rotation.z = open * (i % 2 === 0 ? 0.13 : -0.16);
    }

    if (!reduced && root.current) root.current.rotation.z += delta * 0.008;
  });

  return (
    <group ref={root} position={[14, 132, -196]} scale={5.6}>
      {SEGMENTS.map((start, i) => (
        <group
          key={i}
          ref={(el) => {
            segments.current[i] = el;
          }}
        >
          <mesh rotation={[0, 0, start]}>
            {/* El tubo va grueso a propósito. A doscientos cincuenta unidades
                un radio de 0.14 sale en menos de un píxel y el Anillo se
                pierde justo en el capítulo que cuenta que se rompe. */}
            <torusGeometry args={[8.4, 0.26, 6, 48, ARC]} />
            <meshStandardMaterial
              color="#e8c37a"
              emissive="#e8c37a"
              emissiveIntensity={1.7}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
