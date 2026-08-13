import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshStandardMaterial, PointLight } from 'three';
import { scrollState, mapRange, damp } from '../scrollState';

/**
 * LAS RAÍCES, BAJO LA CAPITAL
 * ------------------------------------------------------------
 * La luz que sigue encendida en la pared del acantilado, donde ya no
 * llega la Gracia. Late siempre, pero se enciende de verdad en el
 * capítulo IV, justo después de que el Árbol se apague arriba: es
 * la misma luz, que se fue para abajo.
 *
 * Con movimiento reducido el latido y el giro se detienen; lo que no
 * se toca es la respuesta al scroll, porque esa la pide el usuario.
 */
export default function Core({ reduced }: { reduced: boolean }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const light = useRef<PointLight>(null);
  const intensity = useRef(0.6);

  useFrame((state, delta) => {
    const mat = material.current;
    const m = mesh.current;
    const l = light.current;
    if (!mat || !m || !l) return;

    const t = state.clock.elapsedTime;
    // Latido base, siempre presente.
    const beat = reduced ? 0.5 : 0.5 + Math.sin(t * 1.6) * 0.18 + Math.sin(t * 3.1) * 0.06;
    // Cerca del capítulo IV el núcleo se revela.
    const reveal = mapRange(scrollState.position, 2.3, 3.2, 0, 1);
    const target = beat * (0.7 + reveal * 3.2);

    intensity.current = damp(intensity.current, target, 4, delta);
    mat.emissiveIntensity = intensity.current;
    l.intensity = 6 + intensity.current * 46;

    const pulse = reduced ? 0 : Math.sin(t * 1.6) * 0.04;
    m.scale.setScalar(1 + pulse + reveal * 0.15);

    if (!reduced) {
      m.rotation.y += delta * 0.12;
      m.rotation.x += delta * 0.05;
    }
  });

  return (
    <group position={[42, -19, 2]}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial
          ref={material}
          color="#e8c37a"
          emissive="#e8c37a"
          emissiveIntensity={0.6}
          roughness={0.25}
          metalness={0.1}
          flatShading
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} color="#e8c37a" intensity={10} distance={54} decay={1.6} />
    </group>
  );
}
