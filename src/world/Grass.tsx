import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { InstancedMesh } from 'three';
import { groundFlatness, groundHeight } from './terrain/heightfield';
import { makeNoise } from './terrain/noise';

/**
 * LA HIERBA
 * ------------------------------------------------------------
 * Lo que separa un terreno de un paisaje. En las referencias del
 * juego el suelo nunca está desnudo: hay pasto seco por todas
 * partes, y se mueve.
 *
 * Son cuarenta mil briznas en una sola llamada de dibujo. Cada una
 * es un triángulo alargado de cuatro segmentos, y el viento se
 * aplica en el shader: mover cuarenta mil matrices desde JavaScript
 * en cada frame no lo aguanta ningún equipo, pero desplazar sus
 * vértices en la GPU es gratis.
 *
 * La siembra descarta lo empinado (en una pared no crece nada) y lo
 * que queda fuera del borde, y va con semilla fija: el pasto está
 * siempre en el mismo sitio.
 */

const BLADE_SEGMENTS = 4;
const COUNT = 42000;
const FIELD_RADIUS = 34;

/** Una brizna: un triángulo estrecho que se afina hacia la punta. */
function bladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const width = 0.055;

  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS;
    // Se afina hacia arriba y termina en punta.
    const w = width * (1 - t * 0.92);
    positions.push(-w, t, 0, w, t, 0);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** PRNG con semilla, para que el campo sea siempre el mismo. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Blades {
  matrices: Matrix4[];
  phases: Float32Array;
  tints: Float32Array;
}

function sowGrass(): Blades {
  const random = mulberry32(4471);
  // Manchas: el pasto crece a parches, con calvas de tierra entre medio.
  const patches = makeNoise(2291);
  const matrices: Matrix4[] = [];
  const phases: number[] = [];
  const tints: number[] = [];

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);

  let attempts = 0;
  while (matrices.length < COUNT && attempts < COUNT * 6) {
    attempts++;
    // Distribución uniforme en el disco: sin la raíz se amontona en el centro.
    const r = Math.sqrt(random()) * FIELD_RADIUS;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    if (groundFlatness(x, z) < 0.72) continue; // en la pared no crece
    const y = groundHeight(x, z);
    if (y < -1.5) continue; // ya cayó por el acantilado

    const density = patches(x * 0.055, z * 0.055) * 0.5 + 0.5;
    if (random() > 0.25 + density * 1.05) continue;

    position.set(x, y - 0.05, z);
    quaternion.setFromAxisAngle(up, random() * Math.PI);
    const height = (0.34 + random() * 0.5) * (0.7 + density * 0.75);
    scale.set(0.8 + random() * 0.5, height, 1);

    matrices.push(new Matrix4().compose(position, quaternion, scale));
    phases.push(random() * Math.PI * 2);
    tints.push(random());
  }

  return {
    matrices,
    phases: new Float32Array(phases),
    tints: new Float32Array(tints),
  };
}

export default function Grass({ reduced, density }: { reduced: boolean; density: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const blades = useMemo(sowGrass, []);
  const geometry = useMemo(bladeGeometry, []);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: '#b9a86a',
      roughness: 0.95,
      metalness: 0,
      side: DoubleSide,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uBase = { value: new Color('#4a4526') };
      // Con menos briznas, cada una más ancha: así el campo sigue tapando el
      // suelo en un equipo lento, en vez de quedar en matas sueltas.
      shader.uniforms.uWidth = { value: 1 };
      mat.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aPhase;
           attribute float aTint;
           uniform float uTime;
           uniform float uWidth;
           varying float vHeight;
           varying float vTint;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vHeight = uv.y;
           vTint = aTint;
           transformed.x *= uWidth;
           // El viento dobla la brizna, no la inclina: el desplazamiento
           // crece con el cuadrado de la altura, así que la base no se mueve.
           float bend = vHeight * vHeight;
           float gust = sin(uTime * 1.1 + aPhase) * 0.5 + sin(uTime * 2.3 + aPhase * 1.7) * 0.18;
           transformed.x += gust * bend * 0.42;
           transformed.z += gust * bend * 0.22;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uBase;
           varying float vHeight;
           varying float vTint;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // Oscura abajo, seca y clara en la punta, y cada mata con su tono.
           diffuseColor.rgb = mix(uBase, diffuseColor.rgb, 0.25 + vHeight * 0.9);
           diffuseColor.rgb *= 0.75 + vTint * 0.5;`,
        );
    };

    return mat;
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  // Cuántas briznas se dibujan de las que hay sembradas. Como el orden de
  // siembra es aleatorio, quedarse con las primeras es quedarse con una
  // muestra repartida por todo el campo.
  useEffect(() => {
    const instanced = mesh.current;
    if (instanced) instanced.count = Math.round(blades.matrices.length * density);
  }, [blades, density]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    blades.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.geometry.setAttribute('aPhase', new InstancedBufferAttribute(blades.phases, 1));
    instanced.geometry.setAttribute('aTint', new InstancedBufferAttribute(blades.tints, 1));
    instanced.computeBoundingSphere();
  }, [blades]);

  useFrame((state) => {
    const shader = material.userData.shader;
    if (!shader) return;
    // El shader se compila en el primer render, así que el ancho se fija acá
    // y no en un efecto: cuando el efecto corre, el shader todavía no existe.
    shader.uniforms.uWidth.value = Math.min(1.85, 1 / Math.sqrt(density));
    if (!reduced) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, blades.matrices.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}
