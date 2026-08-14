import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three';
import type { Mesh } from 'three';
import { scrollState, damp, clamp } from '../scrollState';
import { burn, rot, shock } from './mood';
import { TREE, TREE_POSITION, TREE_SCALE } from './erdtree/branches';

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
 *
 * Y el cielo es la superficie más grande del cuadro, así que es donde
 * más se notan los dos cambios de la historia: cuando el este se pudre
 * (IV) y cuando el Árbol arde (VIII). No hay filtro de color en el
 * postprocesado que consiga esto: acá el rojo llega desde el fondo y
 * la niebla y las luces lo acompañan.
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
  uniform float uDrift;
  varying vec3 vDir;

  // Ruido de valor con hash: cuatro líneas y no hace falta ninguna textura.
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;

    vec3 col = mix(uGround, uHorizon, smoothstep(0.30, 0.52, h));
    col = mix(col, uZenith, smoothstep(0.50, 0.95, h));

    // ---- Las nubes ----
    // La dirección se proyecta sobre un plano horizontal, que es lo que hace
    // que se aplasten hacia el horizonte igual que las de verdad. Por debajo
    // de unos veinte grados se apagan: ahí la proyección estira tanto el
    // ruido que se ve el patrón, y además es donde la bruma se lo comería.
    float above = smoothstep(0.02, 0.35, dir.y);
    if (above > 0.0) {
      vec2 p = dir.xz / max(dir.y, 0.08) * 0.55 + vec2(uDrift, uDrift * 0.35);
      // Umbral alto: deja jirones sueltos en vez de una sopa gris tapándolo
      // todo. El cielo de esta historia tiene que dejar ver el Árbol.
      float clouds = smoothstep(0.52, 0.86, fbm(p)) * above;
      // Del propio color del cielo, aclarado. Así se tiñen solas cuando el
      // este se pudre o el Árbol arde, sin un uniform aparte.
      vec3 tint = mix(uHorizon, uZenith, 0.35) * 2.6 + uGlow * 0.05;
      col = mix(col, tint, clouds * 0.75);
      // Y el resplandor del Árbol les da por debajo, como a todo lo demás.
      col += uGlow * clouds * pow(max(dot(dir, normalize(uGlowDir)), 0.0), 2.5)
             * uGlowStrength * 0.5;
    }

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

/**
 * Hacia dónde está el resplandor: la copa del Árbol, en el mismo punto
 * donde World pone el emisor de los rayos. Tiene que ser el mismo, o el
 * halo del cielo y los haces de luz salen de sitios distintos.
 */
const GLOW_TARGET = new Vector3(
  TREE_POSITION[0],
  TREE_POSITION[1] + TREE.height * 0.78 * TREE_SCALE,
  TREE_POSITION[2],
);

/** Los tres cielos: el de la Orden, el de la podredumbre y el del incendio. */
const HORIZON = new Color('#1c2013');
const ZENITH = new Color('#333820');
const GLOW = new Color('#d9a552');

const ROT_HORIZON = new Color('#4d1610');
const ROT_ZENITH = new Color('#2b0d0c');

const BURN_HORIZON = new Color('#4a220e');
const BURN_ZENITH = new Color('#2c1407');
const BURN_GLOW = new Color('#ff7a2e');

/** Y el cielo de la Fractura: ceniza, un instante. */
const ASH_HORIZON = new Color('#33332f');
const ASH_ZENITH = new Color('#1a1a18');

export default function Sky({
  reduced,
  strength = 0.46,
}: {
  reduced: boolean;
  strength?: number;
}) {
  const dome = useRef<Mesh>(null);
  const dir = useRef(new Vector3());
  const sick = useRef(0);
  const fire = useRef(0);

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
          uHorizon: { value: HORIZON.clone() },
          uZenith: { value: ZENITH.clone() },
          uGlow: { value: GLOW.clone() },
          uGlowDir: { value: new Vector3(0, 1, 0) },
          uGlowStrength: { value: strength },
          uDrift: { value: 0 },
        },
      }),
    [strength],
  );

  useFrame((state, delta) => {
    const d = dome.current;
    if (!d) return;
    // El domo viaja con la cámara: así nunca se le sale del mundo por
    // mucho que la historia la lleve de un lado a otro.
    d.position.copy(state.camera.position);
    dir.current.copy(GLOW_TARGET).sub(state.camera.position).normalize();
    material.uniforms.uGlowDir.value.copy(dir.current);

    // Las nubes derivan muy despacio. Es el único movimiento autónomo del
    // cielo, así que con movimiento reducido se quedan quietas.
    if (!reduced) material.uniforms.uDrift.value = state.clock.elapsedTime * 0.004;

    const pos = scrollState.position;
    sick.current = damp(sick.current, rot(pos), 2, delta);
    fire.current = damp(fire.current, burn(pos), 1.8, delta);

    // Primero la podredumbre y encima el incendio: el segundo llega mucho
    // después y tiene que poder pisar lo que haya quedado del primero. Y el
    // golpe de la Fractura por encima de todo, que es de un instante.
    const hit = clamp(shock.value, 0, 1);
    const u = material.uniforms;
    u.uHorizon.value
      .lerpColors(HORIZON, ROT_HORIZON, sick.current)
      .lerp(BURN_HORIZON, fire.current)
      .lerp(ASH_HORIZON, hit * 0.9);
    u.uZenith.value
      .lerpColors(ZENITH, ROT_ZENITH, sick.current)
      .lerp(BURN_ZENITH, fire.current)
      .lerp(ASH_ZENITH, hit * 0.9);
    u.uGlow.value.lerpColors(GLOW, BURN_GLOW, fire.current);
    // Un árbol de ciento veinte unidades ardiendo ilumina medio cielo; y
    // cuando el Anillo se parte, el halo se retira con él.
    u.uGlowStrength.value = strength * (1 + fire.current * 1.4) * (1 - hit * 0.8);
  });

  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[130, 32, 20]} />
    </mesh>
  );
}
