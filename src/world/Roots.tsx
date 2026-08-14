import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedBufferAttribute, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { InstancedMesh, PointLight } from 'three';
import { scrollState, damp } from '../scrollState';
import { roots as rootsAt } from './mood';
import { buildTree } from './erdtree/branches';
import type { TreeGeometryData } from './erdtree/branches';
import { groundHeight } from './terrain/heightfield';

/**
 * LAS RAÍCES, BAJO LA CAPITAL
 * ------------------------------------------------------------
 * Lo que sigue encendido en el fondo del barranco, donde ya no
 * llega la Gracia.
 *
 * Antes esto era **un icosaedro con una luz dentro**, y se leía
 * como lo que era: una piedra que brilla. El capítulo habla de
 * raíces, así que hay raíces.
 *
 * Y salen del mismo generador que los dos árboles, girado del
 * revés. Es la tercera vez que se usa, y la que mejor demuestra
 * para qué sirve tenerlo: una raíz **es** un árbol que crece
 * hacia abajo y se abre mucho más. Con otros cinco números sale
 * sola, sin modelar nada.
 *
 * Cuelgan de las dos paredes hacia el centro de la grieta, en
 * tres masas a distinta profundidad, para que se lea el hueco
 * entre ellas. Lo que da la sensación de espacio no son las
 * raíces: es que estén a distancias distintas.
 */

/**
 * UNA RAÍZ LARGA, NO UNA MATA
 *
 * El primer intento usó los números de siempre —muchas generaciones, mucha
 * bifurcación— y salieron matas: bolas de ramitas finas que dentro de una
 * grieta de quince unidades de ancho tapaban el hueco entero y se leían como
 * coral. El barranco es una V estrecha; ahí no cabe un arbusto.
 *
 * La forma que sí cabe es la contraria: **casi todo tronco**. Con siete de las
 * ocho generaciones en régimen de tronco, el eje sigue de largo dieciocho
 * unidades y solo suelta raicillas cortas por el camino. Cruza la grieta de
 * pared a pared y deja ver el vacío, que es lo que hay que ver.
 *
 * Y cuesta cuarenta y cinco ramas en vez de novecientas, así que en lugar de
 * tres matas caben ocho raíces a distintas alturas y profundidades.
 */
const CABLE = {
  seed: 3301,
  levels: 8,
  trunkLevels: 7,
  trunkLength: 3.2,
  trunkRadius: 1.2,
  lengthFalloff: 0.84,
  radiusFalloff: 0.82,
  // Las raicillas salen muy abiertas: una raíz no compite por la luz, busca.
  spreadMin: 0.55,
  spreadMax: 1.15,
  upBias: 0,
  tripleChance: 0.1,
};

const UP = new Vector3(0, 1, 0);

/**
 * El punto de anclaje, metido dentro de la pared.
 *
 * Se calcula con la propia función de altura del terreno en vez de escribirlo
 * a mano: así el arranque queda enterrado por muchos que se muevan el barranco
 * o la semilla del relieve. Con la base al aire se ve el tocón flotando, que
 * es justo lo que delataba la primera versión.
 */
const anchor = (x: number, z: number, sink = 1.6): [number, number, number] => [
  x,
  groundHeight(x, z) - sink,
  z,
];

/** Hacia dónde crece, como dirección y no como ángulos de Euler. */
const aim = (x: number, y: number, z: number): [number, number, number, number] => {
  const q = new Quaternion().setFromUnitVectors(UP, new Vector3(x, y, z).normalize());
  return [q.x, q.y, q.z, q.w];
};

const MASSES: {
  tree: TreeGeometryData;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
}[] = [];

{
  const a = buildTree(CABLE);
  const b = buildTree({ ...CABLE, seed: 8813, tripleChance: 0.2 });
  const c = buildTree({ ...CABLE, seed: 5507, trunkLength: 2.9 });

  // **Cruzan el barranco, no cuelgan de la pared.** El terreno es un mapa de
  // alturas y no tiene salientes: la grieta es una V de sesenta grados, así
  // que una raíz que baje más empinada que la pared se mete dentro y no se
  // ve. Las que sí se ven son las que van más horizontales que la pared y
  // salvan el hueco, que además es la imagen que toca: raíces cruzando una
  // sima, no barbas pegadas a un muro.
  //
  // Van alternando pared y a alturas y profundidades distintas. Lo que hace
  // que se lea el hondo no son las raíces: es que se crucen unas por delante
  // de otras.
  MASSES.push(
    { tree: a, position: anchor(39, -2), quaternion: aim(0.92, -0.32, 0.22), scale: 1 },
    { tree: b, position: anchor(54.5, 5), quaternion: aim(-0.93, -0.26, 0.24), scale: 0.95 },
    { tree: c, position: anchor(40, 13), quaternion: aim(0.9, -0.4, -0.18), scale: 1.05 },
    { tree: a, position: anchor(54, 21), quaternion: aim(-0.9, -0.36, -0.24), scale: 1 },
    { tree: b, position: anchor(39.5, 29), quaternion: aim(0.88, -0.44, 0.18), scale: 1.1 },
    { tree: c, position: anchor(53, 37), quaternion: aim(-0.89, -0.3, 0.32), scale: 1 },
    // Dos más arriba, cerca del borde, que entran por el techo del encuadre.
    { tree: c, position: anchor(37, 8), quaternion: aim(0.85, -0.5, 0.16), scale: 0.85 },
    { tree: a, position: anchor(56, 16), quaternion: aim(-0.86, -0.48, -0.18), scale: 0.85 },
  );
}

/** Una masa de raíces, en una sola llamada de dibujo. */
function RootMass({
  tree,
  material,
  position,
  quaternion,
  scale,
}: {
  tree: TreeGeometryData;
  material: MeshStandardMaterial;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    tree.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.geometry.setAttribute('aGlow', new InstancedBufferAttribute(tree.glow, 1));
    instanced.computeBoundingSphere();
  }, [tree]);

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      {/* Sin sombras: están dentro de un barranco y son la fuente de luz, no
          un obstáculo para ella. */}
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, tree.matrices.length]}
        material={material}
        frustumCulled={false}
      >
        {/* Ocho lados y no seis: estas se ven de cerca, y con seis el tramo
            grueso se lee como una tabla. */}
        <cylinderGeometry args={[0.5, 0.68, 1, 8, 1]} />
      </instancedMesh>
    </group>
  );
}

export default function Roots({ reduced }: { reduced: boolean }) {
  const near = useRef<PointLight>(null);
  const far = useRef<PointLight>(null);
  const glow = useRef(0.6);

  const bark = useMemo(() => {
    const material = new MeshStandardMaterial({
      // Casi negra. Lo que se tiene que ver de una raíz encendida es la luz
      // que sale de ella, no la luz que le dan: con la madera clara, las dos
      // luces puntuales la lavaban a color crema y parecía coral.
      color: '#241c10',
      emissive: '#f0c176',
      emissiveIntensity: 1,
      roughness: 0.78,
      metalness: 0,
      flatShading: true,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uReveal = { value: 0.6 };
      material.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uReveal;')
        // Al revés que en el Árbol: acá la curva es casi recta, porque una
        // raíz no arde en las puntas, lleva luz por dentro de todo el cuerpo.
        // Arranca apagada donde entra en la roca y se enciende conforme se
        // aleja de la pared, que es la lectura que interesa: la luz viene de
        // dentro de la piedra y sale al vacío.
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (0.04 + pow(vGlow, 2.3) * 1.75) * uReveal;',
        );
    };

    return material;
  }, []);
  useEffect(() => () => bark.dispose(), [bark]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // Latido base, siempre presente.
    const beat = reduced ? 0.5 : 0.5 + Math.sin(t * 1.6) * 0.16 + Math.sin(t * 3.1) * 0.05;
    // Llegando al capítulo V las raíces se revelan.
    const reveal = rootsAt(scrollState.position);
    glow.current = damp(glow.current, beat * (0.4 + reveal * 1.7), 4, delta);

    const shader = bark.userData.shader;
    if (shader) shader.uniforms.uReveal.value = glow.current;

    // Dos luces y no una: con una sola, el barranco se lee como un túnel con
    // una bombilla. Con dos a distinta profundidad, las paredes tienen dos
    // gradientes cruzados y el hueco se ve hondo.
    // Flojas a propósito: su trabajo es que se vean las paredes del barranco,
    // no iluminar las raíces. Las raíces se iluminan solas.
    if (near.current) near.current.intensity = 1 + glow.current * 9;
    if (far.current) far.current.intensity = 0.8 + glow.current * 7;
  });

  return (
    <group>
      {MASSES.map((mass, i) => (
        <RootMass key={i} material={bark} {...mass} />
      ))}

      <pointLight
        ref={near}
        position={[42, -18, 6]}
        color="#f0c682"
        distance={48}
        decay={1.7}
      />
      <pointLight
        ref={far}
        position={[48, -14, 18]}
        color="#e8b96a"
        distance={56}
        decay={1.7}
      />
    </group>
  );
}
