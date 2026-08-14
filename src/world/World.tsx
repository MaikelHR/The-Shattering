import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, Stars } from '@react-three/drei';
import { NoToneMapping } from 'three';
import type { Mesh } from 'three';
import Terrain from './Terrain';
import Grass from './Grass';
import Rocks from './Rocks';
import Ruins from './Ruins';
import Capital from './Capital';
import Erdtree from './Erdtree';
import Haligtree from './Haligtree';
import Azula from './Azula';
import BrokenRing from './BrokenRing';
import Roots from './Roots';
import Leaves from './Leaves';
import CameraRig from './CameraRig';
import Sky from './Sky';
import Atmosphere from './Atmosphere';
import { TREE, TREE_POSITION, TREE_SCALE } from './erdtree/branches';
import Post from './Post';
import { QUALITY, detectQuality, downgrade, isForced } from './quality';
import type { Quality } from './quality';

/** El color al que se funde todo a lo lejos, a juego con el cielo. */
const HAZE = '#232617';

/**
 * Avisa a la entrada de que el mundo ya está.
 *
 * Cuenta frames y no montajes a propósito. Montar solo significa que React
 * puso los componentes: los shaders todavía no se compilaron, y eso ocurre
 * la primera vez que cada material se dibuja. Levantar la entrada ahí deja
 * ver un tirón de medio segundo. Con tres frames, ya está todo compilado.
 *
 * Va dentro del `Suspense` de las texturas, así que ni siquiera monta hasta
 * que estas han cargado.
 */
function Ready({ onReady }: { onReady: () => void }) {
  const left = useRef(3);
  useFrame(() => {
    if (left.current <= 0) return;
    left.current -= 1;
    if (left.current === 0) onReady();
  });
  return null;
}

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
export default function World({ reduced, onReady }: { reduced: boolean; onReady: () => void }) {
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

        {/* Niebla exponencial y no lineal. La lineal tiene un principio: hasta
            las veintiséis unidades no había nada de bruma y a partir de ahí
            empezaba de golpe. La exponencial arranca desde el ojo, que es lo
            que hace el aire de verdad, y se nota en los planos cortos —el
            fondo del barranco— más que en los lejanos. */}
        <fogExp2 attach="fog" args={[HAZE, 0.0045]} />
        <Sky reduced={reduced} />

        <Environment resolution={256} frames={1}>
          {/* El Árbol, que es de donde viene casi toda la luz */}
          <Lightformer form="circle" intensity={2.4} color="#ffd79a" scale={14} position={[0, 12, 0]} />
          {/* Cielo alto, más frío y tenue */}
          <Lightformer form="rect" intensity={0.35} color="#6d7a4a" scale={40} position={[0, 30, -20]} rotation={[Math.PI / 2, 0, 0]} />
          {/* Rebote del suelo, pardo */}
          <Lightformer form="rect" intensity={0.25} color="#3a2c16" scale={40} position={[0, -18, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </Environment>

        {/* La niebla, la luz de relleno y el color de los rayos: lo que tiñe
            todo lo demás cuando el este se pudre y cuando el Árbol arde. */}
        <Atmosphere sun={sun} />

        <Suspense fallback={null}>
          <Terrain />
          <Rocks density={q.particles} />
          <Ruins density={q.particles} />
          {/* Al pie del Árbol, y es lo que le da la escala: pone algo de
              tamaño conocido en el hueco que había entre las ruinas de cerca
              y las montañas de lejos. */}
          <Capital />
          <Ready onReady={onReady} />
        </Suspense>
        <Grass reduced={reduced} density={q.particles} />
        <Erdtree reduced={reduced} shadowMap={q.shadowMap} />
        {/* El otro árbol, el que no llegó a florecer, y la ciudad que lleva
            mil años cayéndose. Los dos viven lejos y a contraluz: son
            silueta, y con eso alcanza. */}
        <Haligtree />
        <Azula reduced={reduced} density={q.particles} />
        <BrokenRing reduced={reduced} />
        <Roots reduced={reduced} />

        {/* El emisor de los rayos. Vive dentro de la copa, y son las ramas y
            las ruinas al pasar por delante las que recortan los haces: un
            emisor descubierto lava la pantalla y uno tapado del todo no
            produce nada. Más gordo que antes (siete en vez de cinco): con el
            Árbol de cinco mil ramas hay mucho donde recortarse, así que
            aguanta más emisor sin quemarse. */}
        <mesh
          ref={setSun}
          position={[
            TREE_POSITION[0],
            TREE_POSITION[1] + TREE.height * 0.72 * TREE_SCALE,
            TREE_POSITION[2],
          ]}
        >
          <sphereGeometry args={[7, 16, 16]} />
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
        {/* Las hojas que caen, que sustituyen a las motas de drei: aquellas
            vivían en una caja fija alrededor del origen y se acababan en
            cuanto la cámara se iba de ahí. Estas envuelven a la cámara. */}
        <Leaves reduced={reduced} density={q.particles} />

        <CameraRig reduced={reduced} />
        <Post sun={sun} quality={quality} reduced={reduced} />
      </Canvas>
    </div>
  );
}
