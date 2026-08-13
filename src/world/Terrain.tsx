import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { TERRAIN } from './terrain/heightfield';

/**
 * EL TERRENO
 * ------------------------------------------------------------
 * Una meseta continental con acantilados, generada con ruido (ver
 * `terrain/heightfield.ts`). Reemplaza a las mesetas flotantes, que
 * eran cilindros y se leían como maqueta por muy buena que fuera la
 * textura: lo que se veía imposible era la composición.
 *
 * El material es el estándar de three con dos añadidos, inyectados
 * en su shader:
 *
 *  - **Proyección triplanar.** Un terreno texturizado con sus UV se
 *    estira en las paredes verticales, y en un acantilado eso es
 *    justo donde se mira. Acá la textura se proyecta por los tres
 *    ejes y se mezcla según hacia dónde apunta cada punto, así que
 *    no hay estiramiento en ninguna cara.
 *
 *  - **Dos materiales según la pendiente.** Hierba seca donde el
 *    suelo es llano y roca donde se empina. Es lo que hace que un
 *    terreno se lea como paisaje y no como una única piedra gigante:
 *    en la naturaleza, en las paredes no crece nada.
 */

const TEXTURES = [
  '/textures/dark_rock_diff.webp',
  '/textures/dark_rock_nor.webp',
  '/textures/aerial_grass_rock_diff.webp',
  '/textures/aerial_grass_rock_nor.webp',
];

export default function Terrain() {
  const [rockMap, rockNormal, grassMap, grassNormal] = useTexture(TEXTURES);

  const material = useMemo(() => {
    const maps: Texture[] = [rockMap, rockNormal, grassMap, grassNormal];
    for (const map of maps) {
      map.wrapS = RepeatWrapping;
      map.wrapT = RepeatWrapping;
    }
    rockMap.colorSpace = SRGBColorSpace;
    grassMap.colorSpace = SRGBColorSpace;

    const mat = new MeshStandardMaterial({
      map: rockMap,
      normalMap: rockNormal,
      roughness: 1,
      metalness: 0,
      color: '#9a8c72',
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassMap = { value: grassMap };
      shader.uniforms.uGrassNormal = { value: grassNormal };
      shader.uniforms.uScaleRock = { value: 0.24 };
      shader.uniforms.uScaleGrass = { value: 0.15 };
      shader.uniforms.uGrassTint = { value: new Color('#8f9463') };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;
           varying vec3 vWorldNormal;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
           vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;
           varying vec3 vWorldNormal;
           uniform sampler2D uGrassMap;
           uniform sampler2D uGrassNormal;
           uniform float uScaleRock;
           uniform float uScaleGrass;
           uniform vec3 uGrassTint;

           // Pesos de las tres proyecciones. La potencia alta hace que la
           // transición entre ejes sea corta y no se vea el cruce.
           vec3 triWeights(vec3 n) {
             vec3 w = pow(abs(n), vec3(6.0));
             return w / max(dot(w, vec3(1.0)), 0.0001);
           }

           vec4 triplanar(sampler2D tex, vec3 pos, vec3 w, float scale) {
             return texture2D(tex, pos.zy * scale) * w.x
                  + texture2D(tex, pos.xz * scale) * w.y
                  + texture2D(tex, pos.xy * scale) * w.z;
           }`,
        )
        .replace(
          '#include <map_fragment>',
          `vec3 triW = triWeights(vWorldNormal);
           // Cuanto más vertical, más roca. La curva deja la hierba solo en
           // lo realmente llano, que es donde se agarraría.
           float slope = clamp(vWorldNormal.y, 0.0, 1.0);
           float grassAmount = smoothstep(0.62, 0.88, slope);

           vec4 rockTex = triplanar(map, vWorldPos, triW, uScaleRock);
           vec4 grassTex = triplanar(uGrassMap, vWorldPos, triW, uScaleGrass);
           grassTex.rgb *= uGrassTint * 1.45;
           vec4 sampledDiffuseColor = mix(rockTex, grassTex, grassAmount);
           diffuseColor *= sampledDiffuseColor;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `vec3 rockN = triplanar(normalMap, vWorldPos, triW, uScaleRock).xyz * 2.0 - 1.0;
           vec3 grassN = triplanar(uGrassNormal, vWorldPos, triW, uScaleGrass).xyz * 2.0 - 1.0;
           vec3 mapN = mix(rockN, grassN, grassAmount);
           // Sin tangentes: se perturba la normal del mundo directamente.
           // Para un terreno, que no tiene UV que respetar, alcanza y sobra.
           normal = normalize(normal + vec3(mapN.x, 0.0, mapN.y) * 0.85);`,
        );
    };

    return mat;
  }, [rockMap, rockNormal, grassMap, grassNormal]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh geometry={TERRAIN.geometry} material={material} receiveShadow castShadow />
  );
}
