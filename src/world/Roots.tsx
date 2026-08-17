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
 * UNA RAÍZ LARGA, NO UNA MATA — Y CURVA, NO UNA VARILLA
 *
 * El primer intento usó los números de siempre —muchas generaciones, mucha
 * bifurcación— y salieron matas: bolas de ramitas finas que dentro de una
 * grieta de quince unidades de ancho tapaban el hueco entero y se leían como
 * coral. El barranco es una V estrecha; ahí no cabe un arbusto.
 *
 * La forma que sí cabe es la contraria: **casi todo eje**, con ocho de las
 * diez generaciones en régimen de tronco. El eje sigue de largo casi
 * diecisiete unidades, cruza la grieta de pared a pared y deja ver el vacío,
 * que es lo que hay que ver.
 *
 * Pero esa versión seguía sin leerse como raíces, y las dos razones se pueden
 * medir:
 *
 *  - **Eran rectas.** Un tramo recto con un codo duro cada tanto es una
 *    varilla, y ocho varillas cruzadas son un juego de palitos. Ahora cada
 *    tramo se dobla (`bend`), en cuatro cilindros que giran siempre hacia el
 *    mismo lado: un arco. Una rama va recta porque busca la luz; una raíz va
 *    rodeando lo que se encuentra.
 *  - **Casi no se afinaban.** El grosor iba de 1,2 a 0,17: una relación de
 *    **uno a siete**, o sea un cable. Con el afinado por dentro del tramo
 *    (`taperAlong`) y el eje adelgazando más rápido (`trunkTaper`), la
 *    relación pasa a **uno a cincuenta y nueve**: gorda como un brazo donde
 *    entra en la roca, un pelo donde termina. Eso es una raíz.
 */
const CABLE = {
  seed: 3301,
  levels: 10,
  trunkLevels: 8,
  trunkLength: 3.4,
  trunkRadius: 1.35,
  lengthFalloff: 0.84,
  radiusFalloff: 0.62,
  // Las raicillas salen muy abiertas: una raíz no compite por la luz, busca.
  spreadMin: 0.55,
  spreadMax: 1.15,
  upBias: 0,
  tripleChance: 0.35,
  bend: 1.3,
  bendSteps: 4,
  taperAlong: 0.42,
  trunkTaper: 0.82,
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

/**
 * DÓNDE BRILLA UNA RAÍZ: DONDE ES FINA
 *
 * El generador entrega un brillo por rama que sube con la generación, y para
 * el Árbol es lo correcto: el tronco es madera y las ramitas queman. Acá no
 * servía. Como el eje principal recorre ocho generaciones, su tramo final ya
 * iba por el 80% de la escala y salía casi tan encendido como los pelos del
 * final: el resultado era una masa de un solo valor donde no se distinguía lo
 * gordo de lo fino.
 *
 * Así que el brillo se saca del **radio**, que está guardado en la propia
 * matriz de cada instancia. Es además la lectura física correcta: lo que se
 * ve por transparencia es lo delgado. Una raíz del grosor de un brazo es
 * madera oscura; un pelo de raíz es luz.
 */
function glowByRadius(tree: TreeGeometryData): Float32Array {
  const out = new Float32Array(tree.matrices.length);
  tree.matrices.forEach((matrix, i) => {
    // La escala en x de la matriz es el radio del cilindro.
    const r = matrix.elements[0];
    // Por encima de 0,30 es cuerpo y no da luz; por debajo de 0,05 es un pelo
    // y da toda. Entre medias, un smoothstep.
    const t = Math.min(1, Math.max(0, (0.3 - r) / 0.25));
    out[i] = t * t * (3 - 2 * t);
  });
  return out;
}

const MASSES: {
  tree: TreeGeometryData;
  glow: Float32Array;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
}[] = [];

{
  const a = buildTree(CABLE);
  const b = buildTree({ ...CABLE, seed: 8813, tripleChance: 0.2 });
  const c = buildTree({ ...CABLE, seed: 5507, trunkLength: 3.1 });
  const brillo = new Map([
    [a, glowByRadius(a)],
    [b, glowByRadius(b)],
    [c, glowByRadius(c)],
  ]);
  const con = (
    tree: TreeGeometryData,
    position: [number, number, number],
    quaternion: [number, number, number, number],
    scale: number,
  ) => ({ tree, glow: brillo.get(tree)!, position, quaternion, scale });

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
    con(a, anchor(39, -2), aim(0.92, -0.32, 0.22), 1),
    con(b, anchor(54.5, 5), aim(-0.93, -0.26, 0.24), 0.95),
    con(c, anchor(40, 13), aim(0.9, -0.4, -0.18), 1.05),
    con(a, anchor(54, 21), aim(-0.9, -0.36, -0.24), 1),
    con(b, anchor(39.5, 29), aim(0.88, -0.44, 0.18), 1.1),
    con(c, anchor(53, 37), aim(-0.89, -0.3, 0.32), 1),
    // Dos más arriba, cerca del borde, que entran por el techo del encuadre.
    con(c, anchor(37, 8), aim(0.85, -0.5, 0.16), 0.85),
    con(a, anchor(56, 16), aim(-0.86, -0.48, -0.18), 0.85),
  );
}

/** Una masa de raíces, en una sola llamada de dibujo. */
function RootMass({
  tree,
  glow,
  material,
  position,
  quaternion,
  scale,
}: {
  tree: TreeGeometryData;
  glow: Float32Array;
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
    // El brillo por radio y no el del generador: ver `glowByRadius`.
    instanced.geometry.setAttribute('aGlow', new InstancedBufferAttribute(glow, 1));
    instanced.computeBoundingSphere();
  }, [tree, glow]);

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
      color: '#2c2214',
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
        // La curva era casi recta —la raíz encendida entera, de la pared a la
        // punta— y eso, con el resplandor encima, daba un bulto blanco sin
        // forma: no se veía una raíz, se veía una luz con bultos alrededor.
        //
        // Ahora la emisión se va a las puntas, como en el Árbol. El cuerpo
        // gordo queda oscuro y lo modelan las dos luces puntuales; lo que
        // brilla son las raicillas finas. Además de leerse mejor, dice lo que
        // toca: la luz viene de dentro de la piedra y sale por donde la raíz
        // se abre. Y como lo que se quema son hilos y no troncos, el
        // resplandor los ensancha en vez de fundirlos en una masa.
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (0.05 + pow(vGlow, 1.7) * 2.2) * uReveal;',
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
    glow.current = damp(glow.current, beat * (0.35 + reveal * 1.3), 4, delta);

    const shader = bark.userData.shader;
    if (shader) shader.uniforms.uReveal.value = glow.current;

    // Dos luces y no una: con una sola, el barranco se lee como un túnel con
    // una bombilla. Con dos a distinta profundidad, las paredes tienen dos
    // gradientes cruzados y el hueco se ve hondo.
    // Ahora hacen dos trabajos: las paredes del barranco y el cuerpo de las
    // raíces, que dejó de emitir por sí mismo salvo en las puntas. Sin
    // subirlas, lo gordo se quedaba en silueta negra.
    if (near.current) near.current.intensity = 1.4 + glow.current * 13;
    if (far.current) far.current.intensity = 1 + glow.current * 10;
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
