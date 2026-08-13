import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  GodRays,
  HueSaturation,
  N8AO,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing';
import type { Mesh } from 'three';
import { QUALITY } from './quality';
import type { Quality } from './quality';

/**
 * EL POSTPROCESADO
 * ------------------------------------------------------------
 * Esta es la capa que hace que la geometría deje de verse como una
 * maqueta. Nada de lo que hay debajo cambió: cambia cómo se revela.
 *
 * El orden importa, y es este:
 *
 *  1. rayos      la luz que baja entre las ramas (la firma de la saga)
 *  2. bloom      el Árbol deja de ser amarillo y pasa a ser luz
 *  3. foco       el primer plano se disuelve, como en una captura
 *  4. lente      una pizca de aberración en los bordes
 *  5. color      el virado a verde oliva, que es el color del juego
 *  6. viñeta     esquinas cerradas
 *  7. grano      la suciedad final: sin esto se lee "render"
 *
 * El bloom es global y no selectivo a propósito: con el umbral en 0.32
 * solo lo superan los materiales emisivos sin tone mapping (el Árbol, el
 * núcleo, los aros de las mesetas), así que la roca no brilla y nos
 * ahorramos un pase de render entero.
 */
export default function Post({ sun, quality }: { sun: Mesh | null; quality: Quality }) {
  const q = QUALITY[quality];

  return (
    <EffectComposer multisampling={q.multisampling} enableNormalPass={false}>
      {/* Oclusión ambiental. Va primero porque no es un efecto sino un pase
          completo: oscurece los rincones donde dos superficies se juntan, que
          es lo que hace que las cosas parezcan apoyadas y no pegadas encima. */}
      {q.ambientOcclusion ? (
        <N8AO
          aoRadius={2.2}
          distanceFalloff={0.8}
          intensity={2.4}
          quality={q.aoQuality}
          halfRes={q.aoHalfRes}
          color="#120d07"
        />
      ) : (
        <></>
      )}

      {q.godRays && sun ? (
        <GodRays
          sun={sun}
          samples={q.godRaySamples}
          density={0.86}
          decay={0.90}
          weight={0.20}
          exposure={0.20}
          clampMax={1}
          blur
          kernelSize={KernelSize.SMALL}
          blendFunction={BlendFunction.SCREEN}
        />
      ) : (
        <></>
      )}

      <Bloom
        intensity={1.1}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.18}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
      />

      {q.depthOfField ? (
        <DepthOfField focusDistance={0.02} focalLength={0.045} bokehScale={1.9} height={480} />
      ) : (
        <></>
      )}

      {/* Solo `offset`: los tipos de este efecto en la 3.0.5 colapsan a un
          Omit<Partial<X | undefined>> y rechazan el resto de las props. */}
      <ChromaticAberration offset={[0.00015, 0.00015]} />

      {/* El virado: baja el rojo hacia el oliva y sube el contraste. */}
      <HueSaturation hue={-0.02} saturation={0.14} />
      <BrightnessContrast brightness={0.01} contrast={0.05} />

      {/* El tone mapping va acá y no en el renderer. Con composer, la escena
          se renderiza en HDR y los valores por encima de 1 sobreviven hasta el
          final: sin este paso no se comprimen, se recortan, y el cielo entero
          se va a blanco en cuanto el bloom lo toca. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      <SMAA />
      <Vignette darkness={0.42} offset={0.36} />
      <Noise premultiply opacity={0.032} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}
