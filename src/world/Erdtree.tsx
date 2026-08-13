import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import type { InstancedMesh, PointLight, Points } from 'three';
import { scrollState, mapRange, damp } from '../scrollState';
import { TREE } from './erdtree/branches';

/**
 * EL ÁRBOL ÁUREO
 * ------------------------------------------------------------
 * El foco de la escena y su fuente de luz. Ya no son cinco bultos:
 * son unas dos mil ramas generadas por recursión (ver
 * `erdtree/branches.ts`), todas en una sola llamada de dibujo.
 *
 * Dos detalles que hacen la silueta:
 *
 *  - El brillo sube hacia las puntas. Cada instancia lleva su nivel
 *    en un atributo y el material lo multiplica por la emisión, así
 *    que el tronco es madera y las ramitas queman. Eso necesita
 *    tocar el shader del material estándar, que es lo que hace el
 *    `onBeforeCompile` de abajo.
 *
 *  - Las hojas son puntos en las puntas de las ramas, no geometría.
 *    Seis mil motas doradas que titilan a destiempo.
 *
 * Y lo mejor de tener ramas de verdad: los rayos de luz por fin
 * tienen por dónde colarse.
 *
 * Con la Fractura, el Árbol se apaga y no se recupera: la misma luz
 * aparece abajo, en las raíces (ver Core.tsx).
 */
export default function Erdtree({
  reduced,
  shadowMap,
}: {
  reduced: boolean;
  shadowMap: number;
}) {
  const branches = useRef<InstancedMesh>(null);
  const leaves = useRef<Points>(null);
  const light = useRef<PointLight>(null);
  const blaze = useRef(1);

  const tree = TREE;

  // ---- Material de las ramas ----
  const bark = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: '#d8c9a8',
      emissive: '#e8b455',
      emissiveIntensity: 1,
      roughness: 0.62,
      metalness: 0,
      flatShading: true,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBlaze = { value: 1 };
      material.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uBlaze;')
        // El nivel de la rama manda: el tronco casi no emite y las puntas
        // se van a blanco. La curva es cúbica para que el cambio ocurra
        // solo en las dos últimas generaciones.
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= pow(vGlow, 3.0) * 3.4 * uBlaze;',
        );
    };

    return material;
  }, []);
  useEffect(() => () => bark.dispose(), [bark]);

  // ---- Material de las hojas ----
  const spark = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255, 235, 190, 1)');
      grad.addColorStop(0.35, 'rgba(240, 195, 110, 0.55)');
      grad.addColorStop(1, 'rgba(230, 170, 70, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);

  const foliage = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uMap: { value: spark },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uSize: { value: 300 },
          uColor: { value: new Color('#f7d79a') },
        },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          uniform float uTime;
          uniform float uSize;
          varying float vTwinkle;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Cada mota late a su ritmo: sin esto la copa parpadea entera.
            vTwinkle = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase * 6.2831);
            gl_PointSize = uSize * vTwinkle * (1.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vTwinkle;
          void main() {
            vec4 tex = texture2D(uMap, gl_PointCoord);
            gl_FragColor = vec4(uColor * vTwinkle, tex.a * uOpacity * vTwinkle);
            if (gl_FragColor.a < 0.01) discard;
          }
        `,
      }),
    [spark],
  );
  useEffect(
    () => () => {
      foliage.dispose();
      spark.dispose();
    },
    [foliage, spark],
  );

  // ---- Geometría de las hojas: una mota por punta de rama ----
  const leafGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(tree.tips.length * 3);
    const phases = new Float32Array(tree.tips.length);

    tree.tips.forEach((tip, i) => {
      positions[i * 3] = tip.x;
      positions[i * 3 + 1] = tip.y;
      positions[i * 3 + 2] = tip.z;
      phases[i] = Math.random();
    });

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
    return geometry;
  }, [tree]);
  useEffect(() => () => leafGeometry.dispose(), [leafGeometry]);

  // Las matrices se vuelcan una sola vez, después del montaje.
  useLayoutEffect(() => {
    const mesh = branches.current;
    if (!mesh) return;

    tree.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aGlow', new InstancedBufferAttribute(tree.glow, 1));
    mesh.computeBoundingSphere();
  }, [tree]);

  useFrame((state, delta) => {
    const l = light.current;
    if (!l) return;

    // La Fractura le baja la luz al Árbol y no se la devuelve.
    const target = mapRange(scrollState.position, 0.55, 1.7, 1, 0.28);
    blaze.current = damp(blaze.current, target, 2.2, delta);

    const shader = bark.userData.shader;
    if (shader) shader.uniforms.uBlaze.value = blaze.current;

    foliage.uniforms.uOpacity.value = blaze.current;
    foliage.uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    l.intensity = 5 + blaze.current * 42;

    if (!reduced && leaves.current) {
      // La copa entera respira, muy lento. Un árbol no se queda quieto.
      leaves.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.09) * 0.03;
    }
  });

  return (
    <group position={[0, 0.7, 0]}>
      <instancedMesh
        ref={branches}
        args={[undefined, undefined, tree.matrices.length]}
        material={bark}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {/* Un cilindro de una unidad, centrado: cada instancia lo estira y lo
            gira hasta su sitio. Seis lados alcanzan, y el follaje tapa el resto. */}
        <cylinderGeometry args={[0.5, 0.62, 1, 6, 1]} />
      </instancedMesh>

      <points ref={leaves} geometry={leafGeometry} material={foliage} frustumCulled={false} />

      <pointLight
        ref={light}
        position={[0, tree.height * 0.82, 0]}
        color="#ffcf87"
        distance={44}
        decay={1.5}
      />

      {/* La sombra sale del Árbol, no del sol: es de donde viene la luz que
          se ve. Un foco apuntando al suelo cuesta un solo pase de sombra,
          mientras que la luz puntual de arriba costaría seis (una por cara
          del cubo), y desde abajo el resultado es el mismo: el ramaje
          dibujado sobre la roca. */}
      <spotLight
        position={[0, tree.height * 0.78, 0]}
        angle={1.05}
        penumbra={0.85}
        intensity={reduced ? 12 : 18}
        distance={70}
        decay={1.2}
        color="#ffd9a0"
        castShadow={shadowMap > 0}
        shadow-mapSize={[shadowMap || 1024, shadowMap || 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.035}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </group>
  );
}
