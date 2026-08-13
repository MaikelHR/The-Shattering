import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, Sparkles, Stars } from '@react-three/drei';
import { NoToneMapping } from 'three';
import type { Mesh } from 'three';
import Terrain from './Terrain';
import Grass from './Grass';
import Rocks from './Rocks';
import Ruins from './Ruins';
import Erdtree from './Erdtree';
import BrokenRing from './BrokenRing';
import Core from './Core';
import CameraRig from './CameraRig';
import Sky from './Sky';
import { TREE, TREE_POSITION, TREE_SCALE } from './erdtree/branches';
import Post from './Post';
import { QUALITY, detectQuality, downgrade, isForced } from './quality';
import type { Quality } from './quality';

/** El color al que se funde todo a lo lejos, a juego con el cielo. */
const HAZE = '#232617';

/**
 * El mundo vive en un canvas fijo detrás del texto.
 * No scrollea: lo que se mueve es la cámara, conducida por GSAP.
 *
 * La luz no viene solo de las tres luces de siempre. Hay además un
 * entorno (`Environment`) armado con paneles emisivos: es la misma idea
 * que un HDRI —iluminar con una imagen del cielo en vez de con focos—
 * pero generado en la propia escena, así que no hay que descargar un
 * archivo de varios megas y el color se ajusta a mano. Se renderiza una
 * sola vez (`frames={1}`) y queda cacheado.
 */
export default function World({ reduced }: { reduced: boolean }) {
  const [quality, setQuality] = useState<Quality>(detectQuality);
  const [sun, setSun] = useState<Mesh | null>(null);
  const q = QUALITY[quality];

  return (
    <div className="world" aria-hidden="true">
      <Canvas
        shadows={q.shadowMap > 0}
        camera={{ position: [0, 8, 26], fov: 45, near: 0.5, far: 700 }}
        dpr={q.dpr}
        // Sin tone mapping en el renderer: lo aplica el composer al final de la
        // cadena, para que todos los efectos trabajen con luz lineal.
        gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: 'high-performance' }}
        // Los eventos de puntero se escuchan en todo el documento, no solo
        // en el canvas: el texto está encima y lo tapa. Sin esto, la deriva
        // de la cámara se congela apenas el mouse pasa sobre un capítulo.
        eventSource={document.body}
        eventPrefix="client"
      >
        {/* Si el equipo no llega, se baja un escalón y no se vuelve a subir:
            ir y venir entre calidades se nota más que la calidad en sí. */}
        {!isForced() && (
          <PerformanceMonitor
            onDecline={() => setQuality((current) => downgrade(current))}
            flipflops={2}
          />
        )}

        <fog attach="fog" args={[HAZE, 26, 330]} />
        <Sky />

        <Environment resolution={256} frames={1}>
          {/* El Árbol, que es de donde viene casi toda la luz */}
          <Lightformer form="circle" intensity={2.4} color="#ffd79a" scale={14} position={[0, 12, 0]} />
          {/* Cielo alto, más frío y tenue */}
          <Lightformer form="rect" intensity={0.35} color="#6d7a4a" scale={40} position={[0, 30, -20]} rotation={[Math.PI / 2, 0, 0]} />
          {/* Rebote del suelo, pardo */}
          <Lightformer form="rect" intensity={0.25} color="#3a2c16" scale={40} position={[0, -18, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </Environment>

        <ambientLight intensity={0.12} />

        <Suspense fallback={null}>
          <Terrain />
          <Rocks density={q.particles} />
          <Ruins density={q.particles} />
        </Suspense>
        <Grass reduced={reduced} density={q.particles} />
        <Erdtree reduced={reduced} shadowMap={q.shadowMap} />
        <BrokenRing reduced={reduced} />
        <Core reduced={reduced} />

        {/* El emisor de los rayos: vive dentro de la copa, y son las ramas
            y las ruinas al pasar por delante las que recortan los haces. */}
        <mesh
          ref={setSun}
          position={[
            TREE_POSITION[0],
            TREE_POSITION[1] + TREE.height * 0.78 * TREE_SCALE,
            TREE_POSITION[2],
          ]}
        >
          <sphereGeometry args={[5, 16, 16]} />
          <meshBasicMaterial color="#f6cf96" toneMapped={false} fog={false} />
        </mesh>

        <Stars
          radius={260}
          depth={90}
          count={Math.round(2200 * q.particles) * (reduced ? 0.4 : 1)}
          factor={3.2}
          fade
          speed={reduced ? 0 : 0.4}
        />
        {/* Las motas doradas que flotan alrededor del Árbol */}
        <Sparkles
          count={Math.round(110 * q.particles)}
          scale={[46, 30, 46]}
          position={[0, 8, -8]}
          size={2.6}
          speed={reduced ? 0 : 0.18}
          color="#f0cf8a"
          opacity={0.5}
        />

        <CameraRig reduced={reduced} />
        <Post sun={sun} quality={quality} reduced={reduced} />
      </Canvas>
    </div>
  );
}
