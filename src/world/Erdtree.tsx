import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, MeshStandardMaterial } from 'three';
import type { Group, PointLight } from 'three';
import { scrollState, mapRange, damp } from '../scrollState';

/** Ramas: [ángulo alrededor del tronco, altura de salida, inclinación, largo]. */
const BRANCHES: [number, number, number, number][] = [
  [0.4, 5.6, 0.62, 2.8],
  [2.3, 6.6, 0.48, 2.3],
  [3.9, 5.0, 0.68, 2.5],
  [5.4, 7.0, 0.42, 2.0],
];

/** Masas de follaje: [x, y, z, escala]. Tres bultos hacen mejor silueta que una esfera. */
const CROWN: [number, number, number, number][] = [
  [0, 10.4, 0, 2.5],
  [-2.0, 9.3, 0.6, 1.7],
  [1.9, 9.6, -0.5, 1.8],
  [-0.9, 11.2, -1.1, 1.4],
  [1.1, 11.0, 1.0, 1.2],
];

/**
 * EL ÁRBOL ÁUREO
 * ------------------------------------------------------------
 * El foco de la escena y su fuente de luz. Brilla entero mientras
 * dura la Orden y se apaga con la Fractura, justo cuando el núcleo
 * de abajo empieza a encenderse: la luz no se pierde, se va a las
 * raíces. Toda esa coreografía sale de un solo número, el progreso
 * del scroll, leído acá y en Core.tsx.
 */
export default function Erdtree({ reduced }: { reduced: boolean }) {
  const crown = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const blaze = useRef(1);

  // Un material para las tres masas: hay que mutarle la emisión en cada
  // frame, y con tres copias habría que sincronizarlas a mano.
  const leaves = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#e6bd72',
        emissive: '#dfa347',
        emissiveIntensity: 1.4,
        roughness: 0.55,
        metalness: 0,
        flatShading: true,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => leaves.dispose(), [leaves]);

  // El degradado del halo, pintado en un canvas al vuelo: sin archivo que
  // descargar y sin shader propio.
  const glow = useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255, 214, 140, 0.55)');
      grad.addColorStop(0.22, 'rgba(255, 197, 105, 0.26)');
      grad.addColorStop(0.55, 'rgba(226, 160, 70, 0.07)');
      grad.addColorStop(1, 'rgba(226, 160, 70, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);

  useFrame((state, delta) => {
    const l = light.current;
    if (!l) return;

    // La Fractura le baja la luz al Árbol y no se la devuelve.
    const target = mapRange(scrollState.position, 0.55, 1.7, 1, 0.3);
    blaze.current = damp(blaze.current, target, 2.2, delta);

    leaves.emissiveIntensity = 0.2 + blaze.current * 0.72;
    l.intensity = 8 + blaze.current * 46;

    if (!reduced && crown.current) {
      // La copa respira, muy lento. Un árbol no se queda quieto.
      const t = state.clock.elapsedTime;
      crown.current.scale.setScalar(1 + Math.sin(t * 0.35) * 0.012);
      crown.current.rotation.y = Math.sin(t * 0.12) * 0.04;
    }
  });

  return (
    <group position={[0, 0.7, 0]}>
      {/* Tronco: se abre abajo, donde se mete en la meseta */}
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.3, 0.85, 8.8, 7, 1]} />
        <meshStandardMaterial color="#5c4a2c" roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {BRANCHES.map(([angle, y, tilt, len], i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[Math.sin(tilt) * len * 0.5, y + len * 0.35, 0]} rotation={[0, 0, -tilt]}>
            <cylinderGeometry args={[0.06, 0.16, len, 5, 1]} />
            <meshStandardMaterial color="#5c4a2c" roughness={0.85} metalness={0.05} flatShading />
          </mesh>
        </group>
      ))}

      <group ref={crown}>
        {/* El resplandor: un sprite con un degradado radial pintado a mano.
            Con una esfera translúcida se veía el contorno, que es justo lo
            que un halo no puede tener. Y sale mucho más barato que traer un
            pipeline de postprocesado entero para un solo bloom. */}
        <sprite position={[0, 10.1, 0]} scale={[17, 13, 1]}>
          <spriteMaterial
            map={glow}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {CROWN.map(([x, y, z, s], i) => (
          <mesh key={i} position={[x, y, z]} scale={[s, s * 0.62, s]} material={leaves}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        ))}
        <pointLight ref={light} position={[0, 9.8, 0]} color="#ffcf87" distance={38} decay={1.5} />
      </group>
    </group>
  );
}
