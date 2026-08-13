import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three';
import type { Mesh } from 'three';

/**
 * EL CIELO
 * ------------------------------------------------------------
 * Antes era un degradado de CSS por detrás de un canvas con alpha.
 * Se veía bien, pero con postprocesado deja de servir: el bloom, el
 * grano y la viñeta se aplicarían solo a la geometría y el fondo
 * quedaría limpio por debajo. Justo la costura que queremos evitar.
 *
 * Así que el cielo entra en la escena, como un domo que acompaña a la
 * cámara. Sigue siendo un degradado, pero ahora recibe el mismo
 * tratamiento que todo lo demás. El resplandor no está pegado arriba:
 * apunta al Árbol, así que gira cuando la cámara lo rodea.
 */

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uGround;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uGlow;
  uniform vec3 uGlowDir;
  uniform float uGlowStrength;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;

    vec3 col = mix(uGround, uHorizon, smoothstep(0.30, 0.52, h));
    col = mix(col, uZenith, smoothstep(0.50, 0.95, h));

    // El halo alrededor del Árbol, que es de donde viene toda la luz.
    float d = max(dot(dir, normalize(uGlowDir)), 0.0);
    // Tres capas de halo: una muy ancha que tiñe medio cielo, otra media
    // y un núcleo pequeño. Con una sola, el borde se lee como un disco.
    col += uGlow * pow(d, 1.6) * uGlowStrength * 0.10;
    col += uGlow * pow(d, 8.0) * uGlowStrength * 0.16;
    col += uGlow * pow(d, 38.0) * uGlowStrength * 0.30;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Hacia dónde está el resplandor: la copa del Árbol. */
const GLOW_TARGET = new Vector3(0, 10.5, 0);

export default function Sky({ strength = 0.46 }: { strength?: number }) {
  const dome = useRef<Mesh>(null);
  const dir = useRef(new Vector3());

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: {
          uGround: { value: new Color('#0a0a06') },
          uHorizon: { value: new Color('#1c2013') },
          uZenith: { value: new Color('#333820') },
          uGlow: { value: new Color('#d9a552') },
          uGlowDir: { value: new Vector3(0, 1, 0) },
          uGlowStrength: { value: strength },
        },
      }),
    [strength],
  );

  useFrame((state) => {
    const d = dome.current;
    if (!d) return;
    // El domo viaja con la cámara: así nunca se le sale del mundo por
    // mucho que la historia la lleve de un lado a otro.
    d.position.copy(state.camera.position);
    dir.current.copy(GLOW_TARGET).sub(state.camera.position).normalize();
    material.uniforms.uGlowDir.value.copy(dir.current);
  });

  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[130, 32, 20]} />
    </mesh>
  );
}
