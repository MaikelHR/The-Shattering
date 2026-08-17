import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  PointsMaterial,
} from 'three';
import type { InstancedMesh } from 'three';
import { buildTree } from './erdtree/branches';
import { groundHeight } from './terrain/heightfield';

/**
 * EL ÁRBOL SAGRADO
 * ------------------------------------------------------------
 * El segundo árbol, el que Miquella plantó lejos y nunca llegó a florecer.
 * Sale del mismo generador que el Áureo, con otros números, y ahí está toda
 * la idea: dos árboles del mismo código que se leen distinto porque la forma
 * la deciden los parámetros.
 *
 * **Lo que estaba mal no era la forma.** Se midió antes de tocar nada, y la
 * proporción de este —cincuenta y ocho de alto por sesenta y nueve de ancho,
 * relación 0,84— resulta ser **la misma que la del Áureo**, que es 0,85. Los
 * dos son más anchos que altos y el Áureo se ve perfecto. Cambiar la silueta
 * habría sido arreglar lo que no estaba roto.
 *
 * Lo que estaba mal era la luz, y eran tres cosas a la vez:
 *
 *  - **No tenía degradado.** El Áureo lleva el nivel de cada rama en un
 *    atributo y la emisión sube hacia las puntas: tronco de madera, ramitas
 *    ardiendo. Este emitía lo mismo de arriba abajo, así que salía una masa
 *    plana de un solo valor. Una silueta recortada, no un árbol.
 *  - **No se le veía el follaje.** Las motas eran de medio metro y con un
 *    tercio de opacidad: a ciento cincuenta unidades, nada. Lo que quedaba
 *    era el esqueleto pelado, que se lee como árbol muerto en invierno y no
 *    como árbol que no llegó a florecer.
 *  - **Era verde.** Y eso es lo que más lo delataba: en el juego la paleta de
 *    este árbol es blanco, plata y oro sin alear —una luz pálida y fría que
 *    parodia el oro del Áureo—, nunca verde. Un verde apagado contra un mundo
 *    dorado no lee como «otro árbol», lee como vegetación muerta.
 *
 * Así que ahora es hueso y plata, con la emisión subiendo a las puntas como
 * el Áureo pero a menos de la mitad de fuerza: si brillara igual dejaría de
 * ser el que no floreció. El contraste con el oro se consigue quitándole
 * color, no cambiándoselo: no hay un solo azul en toda la página.
 */

/**
 * La forma sale de medirla contra el Áureo, que es el que se ve bien.
 *
 * La primera versión tenía el **42% de la altura en tronco pelado** —cinco
 * generaciones de tronco antes de abrirse— contra el 18% del Áureo, y la copa
 * le quedaba en cuatro pompones arriba del palo. Con tres generaciones de
 * tronco y el ángulo abierto, el tronco pelado cae al 21% y la copa ocupa el
 * resto. Ahí se quedó, y ahí sigue.
 *
 * Y son dos mil ramas y no seis mil como el Áureo, a propósito: este mide la
 * mitad y se ve a la misma distancia, así que con la mitad de tamaño angular
 * la misma cuenta se vería el doble de densa.
 */
const HALIGTREE = buildTree({
  seed: 77021,
  levels: 9,
  trunkLength: 2.6,
  trunkRadius: 0.9,
  lengthFalloff: 0.8,
  radiusFalloff: 0.66,
  spreadMin: 0.3,
  spreadMax: 0.66,
  upBias: 0.16,
  tripleChance: 0.5,
  trunkLevels: 3,
});

const SCALE = 3.85;

/**
 * Al suroeste, sobre la cordillera.
 *
 * La altura no se escribe a mano, y tampoco vale con preguntar por el suelo
 * en el centro: **el árbol se apoya en toda su huella, no en un punto.** Ahí
 * arriba el relieve es cordillera, y bajo el tronco —tres metros y medio de
 * radio— el suelo va de 25 a 34. Puesto a la altura del centro, un lado del
 * tronco quedaba enterrado y el otro colgando en el aire cinco unidades, que
 * es exactamente lo que se veía: un árbol sin pie.
 *
 * Así que se busca el punto MÁS BAJO de la huella y se hunde tres unidades
 * más. Sobra tronco por debajo, no se ve, y el árbol pesa.
 */
function baseHeight(x: number, z: number, radius: number): number {
  let min = groundHeight(x, z);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    for (const r of [radius * 0.5, radius]) {
      min = Math.min(min, groundHeight(x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
  }
  return min - 3;
}

const POSITION: [number, number, number] = [-135, baseHeight(-135, 78, 0.9 * SCALE), 78];

export default function Haligtree() {
  const branches = useRef<InstancedMesh>(null);

  const bark = useMemo(() => {
    const material = new MeshStandardMaterial({
      // Hueso, no menta. Un gris cálido muy desaturado: lo que lo separa del
      // Áureo es que no tiene color, no que tenga otro.
      color: '#8e8b82',
      emissive: '#efe9d6',
      emissiveIntensity: 1,
      roughness: 0.7,
      metalness: 0,
      flatShading: true,
    });

    // El mismo truco que el Áureo: cada instancia lleva su nivel y la emisión
    // sube hacia las puntas. Con la curva un pelo más cerrada que la del Áureo
    // y a un tercio de su fuerza (1,15 contra 3,4). Lo segundo es lo que dice
    // la historia —este es el que no floreció, y eso tiene que verse en cuánta
    // luz da—, y lo primero es lo que salva la copa: con la emisión repartida
    // por todo el ramaje fino, las ramas se funden entre ellas y vuelve el
    // brócoli, ahora en blanco. Encendiendo solo las últimas generaciones, la
    // copa recupera el dentro y el fuera.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.04 + pow(vGlow, 3.2) * 1.15;',
        );
    };

    return material;
  }, []);

  /**
   * La mota de follaje: un degradado radial en un lienzo, no un cuadrado.
   *
   * Sin textura, un punto de WebGL es un cuadrado de color plano, y dos mil
   * cuadrados a esta distancia se ven como grano de televisión vieja. Con el
   * degradado se funden entre ellos y hacen copa.
   */
  const mote = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(246, 244, 232, 1)');
      grad.addColorStop(0.4, 'rgba(226, 224, 206, 0.5)');
      grad.addColorStop(1, 'rgba(210, 208, 190, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);

  const foliage = useMemo(
    () =>
      new PointsMaterial({
        map: mote,
        color: '#f2eedc',
        // Tamaño en unidades del mundo, no en píxeles: así se achica con la
        // distancia como se achica todo lo demás.
        //
        // Y era demasiado chico. Con 0,14 —medio metro ya escalado— a ciento
        // cincuenta unidades cada mota medía cuatro píxeles al 34% de
        // opacidad: no se veía ninguna, y el árbol quedaba en esqueleto. Con
        // 0,34 y la mota difuminada hay copa sin que se cierre en bolas, que
        // era el otro extremo, el del brócoli.
        size: 0.34,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [mote],
  );

  const leaves = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(HALIGTREE.tips.length * 3);
    HALIGTREE.tips.forEach((tip, i) => {
      positions[i * 3] = tip.x;
      positions[i * 3 + 1] = tip.y;
      positions[i * 3 + 2] = tip.z;
    });
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(
    () => () => {
      bark.dispose();
      foliage.dispose();
      mote.dispose();
      leaves.dispose();
    },
    [bark, foliage, mote, leaves],
  );

  useLayoutEffect(() => {
    const mesh = branches.current;
    if (!mesh) return;
    HALIGTREE.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aGlow', new InstancedBufferAttribute(HALIGTREE.glow, 1));
    mesh.computeBoundingSphere();
  }, []);

  return (
    // Torcido cinco grados. No es un detalle gratis: el Áureo está a plomo
    // porque sostuvo el mundo, y este se quedó a medias. Un árbol perfectamente
    // vertical se lee como un ejemplar sano; uno inclinado, como uno que creció
    // mal. Cuesta una línea.
    <group position={POSITION} scale={SCALE} rotation={[0.04, 0.6, -0.09]}>
      {/* Sin sombras: queda fuera del volumen que cubre el mapa de sombra de
          la direccional, así que pedirlas sería pagar por nada. */}
      <instancedMesh
        ref={branches}
        args={[undefined, undefined, HALIGTREE.matrices.length]}
        material={bark}
      >
        <cylinderGeometry args={[0.5, 0.62, 1, 5, 1]} />
      </instancedMesh>

      <points geometry={leaves} material={foliage} />
    </group>
  );
}
