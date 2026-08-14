import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Points } from 'three';
import { scrollState, damp } from '../scrollState';
import { burn, soot, updraft } from './mood';

/**
 * LO QUE FLOTA EN EL AIRE
 * ------------------------------------------------------------
 * Hojas doradas cayendo. Es lo que separa un paisaje quieto de un
 * sitio con aire dentro, y en las capturas del juego está siempre.
 *
 * Tres decisiones que lo sostienen:
 *
 *  - **El campo va con la cámara, pero las hojas no.** Si el grupo
 *    siguiera a la cámara sin más, las hojas viajarían con ella y
 *    no habría paralaje: se leerían como suciedad en el objetivo.
 *    Acá cada hoja se envuelve alrededor de la cámara con un `mod`
 *    en el shader, así que el campo es infinito sin serlo y cada
 *    hoja se queda donde está mientras la cámara pasa.
 *
 *  - **Tres tamaños.** Las grandes van cerca y el desenfoque del
 *    postprocesado las disuelve; las pequeñas, lejos y nítidas.
 *    Esa diferencia es la que da la sensación de volumen de aire;
 *    con un tamaño solo, se ve una cortina.
 *
 *  - **Caen o suben según dónde vaya la historia.** En el barranco
 *    la luz sale de la tierra, así que lo que flota sube. Y
 *    saliendo de Caelid las hojas son ceniza. Las dos cosas las
 *    decide `mood.ts`, como todo lo demás.
 *
 * Van en `Points` y no en planos con `Billboard`: un punto ya está
 * siempre de cara a la cámara sin matriz que calcular, y la forma
 * de hoja la pone la textura, que se gira en el shader para que
 * volteen al caer.
 */

/** La caja alrededor de la cámara dentro de la que vive el campo. */
const BOX = new Vector3(78, 54, 78);

const GOLD = new Color('#f2cf8e');
const EMBER = new Color('#ff8b3a');
const SOOT = new Color('#7d6a5c');

/** PRNG con semilla: el campo es siempre el mismo. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Leaves({ reduced, density }: { reduced: boolean; density: number }) {
  const points = useRef<Points>(null);
  const soften = useRef({ soot: 0, updraft: -1, fire: 0 });

  /** La hoja: una elipse blanda, que girada en el shader voltea al caer. */
  const sprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.62)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      // Aplastada en un eje: de frente es una hoja, de canto una raya.
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(0.55, 1);
      ctx.translate(-size / 2, -size / 2);
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }
    return new CanvasTexture(canvas);
  }, []);

  const geometry = useMemo(() => {
    const random = mulberry32(9973);
    const count = 900;
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const scale = new Float32Array(count);
    const speed = new Float32Array(count);
    const spin = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (random() - 0.5) * BOX.x;
      pos[i * 3 + 1] = (random() - 0.5) * BOX.y;
      pos[i * 3 + 2] = (random() - 0.5) * BOX.z;
      phase[i] = random() * Math.PI * 2;
      spin[i] = random() * Math.PI * 2;

      // Tres tamaños, y las grandes son pocas: son las que van cerca, y
      // cerca no puede haber muchas o tapan la escena.
      const luck = random();
      const clase = luck > 0.88 ? 2.6 + random() * 1.4 : luck > 0.58 ? 1.1 + random() * 0.6 : 0.4 + random() * 0.4;
      scale[i] = clase;
      // Las grandes caen más rápido porque están cerca: es paralaje, no peso.
      speed[i] = 0.5 + clase * 0.55 + random() * 0.3;
    }

    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    g.setAttribute('aScale', new Float32BufferAttribute(scale, 1));
    g.setAttribute('aSpeed', new Float32BufferAttribute(speed, 1));
    g.setAttribute('aSpin', new Float32BufferAttribute(spin, 1));
    // Sin recorte: el campo envuelve a la cámara, así que su esfera
    // envolvente de origen no dice nada de dónde está en realidad.
    g.boundingSphere = null;
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uMap: { value: sprite },
          uTime: { value: 0 },
          uCam: { value: new Vector3() },
          uBox: { value: BOX },
          uSize: { value: 26 },
          uOpacity: { value: 0.62 },
          uUpdraft: { value: -1 },
          uSoot: { value: 0 },
          uColor: { value: GOLD.clone() },
          uSootColor: { value: SOOT.clone() },
        },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          attribute float aScale;
          attribute float aSpeed;
          attribute float aSpin;
          uniform float uTime;
          uniform vec3 uCam;
          uniform vec3 uBox;
          uniform float uSize;
          uniform float uUpdraft;
          varying float vAngle;

          void main() {
            vec3 p = position;
            p.y += uTime * aSpeed * uUpdraft;
            // Deriva: una hoja no cae a plomo, se va de un lado a otro.
            p.x += sin(uTime * 0.35 + aPhase) * 2.4;
            p.z += cos(uTime * 0.29 + aPhase * 1.3) * 2.0;

            // Envolver alrededor de la cámara. Esto es lo que hace que el
            // campo sea infinito costando novecientas hojas: cuando una se
            // sale por un lado de la caja, entra por el otro, y como eso
            // pasa en el borde —lejos y con niebla— no se ve el salto.
            // Ojo con el nombre: \`half\` es palabra reservada en GLSL y el
            // shader no compila, sin más aviso que un "program not valid".
            vec3 halfBox = uBox * 0.5;
            vec3 rel = mod(p - uCam + halfBox, uBox) - halfBox;
            vec4 mv = modelViewMatrix * vec4(uCam + rel, 1.0);

            vAngle = aSpin + uTime * (0.25 + aPhase * 0.12);
            gl_PointSize = uSize * aScale * (1.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uColor;
          uniform vec3 uSootColor;
          uniform float uSoot;
          uniform float uOpacity;
          varying float vAngle;

          void main() {
            // La textura se gira con la hoja: es lo que hace que volteen.
            vec2 uv = gl_PointCoord - 0.5;
            float c = cos(vAngle);
            float s = sin(vAngle);
            uv = mat2(c, -s, s, c) * uv + 0.5;
            float a = texture2D(uMap, uv).a;
            if (a < 0.02) discard;
            gl_FragColor = vec4(mix(uColor, uSootColor, uSoot), a * uOpacity);
          }
        `,
      }),
    [sprite],
  );

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
      sprite.dispose();
    },
    [material, geometry, sprite],
  );

  // Con menos hojas, cada una un poco más grande: así el aire sigue
  // poblado en un equipo lento en vez de quedar en cuatro motas.
  useEffect(() => {
    const p = points.current;
    if (!p) return;
    p.geometry.setDrawRange(0, Math.round(900 * density));
    material.uniforms.uSize.value = 26 / Math.sqrt(Math.max(0.35, density));
  }, [density, material]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    u.uCam.value.copy(state.camera.position);
    // Con movimiento reducido el tiempo no avanza: las hojas se quedan
    // suspendidas. Siguen estando —el aire no desaparece— pero no se mueven.
    if (!reduced) u.uTime.value = state.clock.elapsedTime;

    const pos = scrollState.position;
    const s = soften.current;
    s.soot = damp(s.soot, soot(pos), 1.6, delta);
    s.updraft = damp(s.updraft, updraft(pos), 1.6, delta);
    s.fire = damp(s.fire, burn(pos), 1.8, delta);

    u.uSoot.value = s.soot;
    u.uUpdraft.value = s.updraft;
    u.uColor.value.lerpColors(GOLD, EMBER, s.fire);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
