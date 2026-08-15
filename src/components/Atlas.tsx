import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CHAPTERS } from '../story';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);

/**
 * EL MAPA
 * ------------------------------------------------------------
 * Lo último que se ve, y el cierre del recorrido: un mapa de las Tierras
 * Intermedias que se dibuja solo mientras se baja, con los nueve capítulos
 * encendiéndose en el orden en que se leyeron.
 *
 * Tres cosas que vale la pena entender:
 *
 *  - **Está en las coordenadas del mundo 3D.** El Árbol al norte, la capital
 *    a sus pies, el este podrido, el barranco, la ciudad que flota al sur y el
 *    otro árbol al suroeste están donde están en la escena, pasados por la
 *    misma proyección: mirar el mundo desde arriba. No es una ilustración que
 *    se parece al mundo; es el mundo, visto de otra manera.
 *
 *  - **Los puntos se encienden siguiendo el trazo, no a intervalos iguales.**
 *    Un `stagger` normal reparte el tiempo por igual entre los nueve, y
 *    entonces el punto se enciende cuando la línea todavía va por la mitad del
 *    tramo, o mucho después de haber pasado. Acá cada punto tiene su instante,
 *    calculado con la longitud acumulada de la ruta hasta él, así que se
 *    encienden exactamente cuando el trazo los alcanza.
 *
 *  - **El marco es el Anillo.** Tres arcos con sus huecos, que es como quedó.
 *    Es lo primero que se dibuja y lo que sostiene todo lo demás.
 */

// ---- La proyección: del mundo al mapa ----
// El mundo útil llega a unas doscientas unidades del centro en cada
// dirección, así que con 0,86 píxeles por unidad entra entero en un lienzo
// de 420 con margen para el Anillo.
const K = 0.86;
const CX = 210;
const CY = 208;
const RING = 186;

/** x del mundo → x del mapa. */
const px = (x: number) => CX + x * K;
/**
 * z del mundo → y del mapa.
 *
 * Sin signo cambiado: en three.js el norte es −z y en SVG arriba es −y, así
 * que las dos convenciones coinciden solas y el norte queda arriba.
 */
const py = (z: number) => CY + z * K;

const n = (v: number) => v.toFixed(1);

/**
 * Ruido barato y estable.
 *
 * Las montañas y las manchas se generan, no se dibujan a mano, pero tienen que
 * salir idénticas en cada visita: un mapa que cambia de forma al recargar no
 * es un mapa. De ahí que no se use `Math.random`.
 */
function rnd(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Un arco de circunferencia centrado en el mapa, en grados. */
function arco(desde: number, hasta: number, r: number): string {
  const a0 = (desde * Math.PI) / 180;
  const a1 = (hasta * Math.PI) / 180;
  const largo = hasta - desde > 180 ? 1 : 0;
  return `M ${n(CX + Math.cos(a0) * r)} ${n(CY + Math.sin(a0) * r)} A ${r} ${r} 0 ${largo} 1 ${n(
    CX + Math.cos(a1) * r,
  )} ${n(CY + Math.sin(a1) * r)}`;
}

/**
 * El Anillo roto, que hace de marco: tres arcos y tres huecos.
 *
 * El hueco más ancho queda arriba del todo, justo encima del Árbol. No es
 * casualidad ni queda bonito por azar: es donde se rompió.
 */
const ANILLO = [arco(-80, 20, RING), arco(36, 144, RING), arco(156, 260, RING)];

/** Una mancha cerrada, para las regiones. Angulosa a propósito: en un mapa
    una región es una curva de nivel, no un óvalo. */
function mancha(cx: number, cy: number, r: number, semilla: number, lados = 13): string {
  const puntos: string[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    const rr = r * (0.7 + rnd(semilla + i) * 0.52);
    puntos.push(`${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr * 0.82)}`);
  }
  return `M ${puntos[0]} ${puntos.slice(1).map((p) => `L ${p}`).join(' ')} Z`;
}

/** Un arbolito: copa, tronco y unas ramas. Sirve para los dos árboles. */
function arbol(cx: number, cy: number, r: number) {
  const ramas: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    ramas.push(`M ${n(cx)} ${n(cy + r * 0.5)} L ${n(cx + Math.cos(a) * r * 0.82)} ${n(cy + Math.sin(a) * r * 0.82)}`);
  }
  return {
    copa: `M ${n(cx)} ${n(cy)} m ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`,
    tronco: `M ${n(cx)} ${n(cy + r * 0.45)} L ${n(cx)} ${n(cy + r * 1.5)}`,
    ramas,
  };
}

const ARBOL_AUREO = arbol(px(6), py(-178), 18);
const ARBOL_SAGRADO = arbol(px(-138), py(72), 11);

/**
 * La cordillera: tres anillos de cumbres, saltándose las que caerían encima
 * de un hito. Es más barato descartar que colocarlas a mano una por una, y
 * queda igual porque nadie cuenta las montañas de un mapa.
 */
const HITOS_XY: [number, number][] = [
  [px(6), py(-178)],
  [px(-138), py(72)],
  [px(30), py(172)],
  [px(116), py(-18)],
];

const MONTES: string[] = (() => {
  const out: string[] = [];
  for (const [radio, cuantos] of [
    [102, 16],
    [132, 22],
    [162, 28],
  ] as const) {
    for (let i = 0; i < cuantos; i++) {
      const a = (i / cuantos) * Math.PI * 2 + (rnd(radio + i) - 0.5) * 0.16;
      const r = radio + (rnd(i * 3 + radio) - 0.5) * 14;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      if (HITOS_XY.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 34)) continue;
      const w = 5.5 + rnd(i + radio * 2) * 4.5;
      const h = 4.5 + rnd(i * 7 + radio) * 5;
      out.push(`M ${n(x - w)} ${n(y + h * 0.45)} L ${n(x)} ${n(y - h * 0.55)} L ${n(x + w)} ${n(y + h * 0.45)}`);
    }
  }
  return out;
})();

/** La muralla de la capital, siguiendo la misma curva que en la escena. */
const MURALLA = (() => {
  const puntos: string[] = [];
  for (let x = -62; x <= 62; x += 4) puntos.push(`${n(px(x))} ${n(py(-100 - (x / 60) ** 2 * 9))}`);
  return `M ${puntos[0]} ${puntos.slice(1).map((p) => `L ${p}`).join(' ')}`;
})();

/** Las torres de la muralla, como marcas cortas hacia adentro. */
const TORRES = [-52, -30, -8, 14, 36, 56].map((x) => {
  const z = -100 - (x / 60) ** 2 * 9;
  return `M ${n(px(x))} ${n(py(z))} L ${n(px(x))} ${n(py(z) - 6)}`;
});

/** El barranco: corre de norte a sur y se cierra por los extremos. */
const BARRANCO = (() => {
  const puntos: string[] = [];
  for (let z = -46; z <= 50; z += 8) {
    const desvio = (rnd(z + 90) - 0.5) * 7;
    puntos.push(`${n(px(47) + desvio)} ${n(py(z))}`);
  }
  return `M ${puntos[0]} ${puntos.slice(1).map((p) => `L ${p}`).join(' ')}`;
})();

/** Farum Azula: cuatro piedras sueltas, que es lo que es. */
const AZULA = [
  [0, -14, 13, 7],
  [-12, 0, 10, 6],
  [11, 3, 9, 5],
  [-2, 13, 7, 4],
].map(([dx, dy, w, h]) => {
  const x = px(30) + dx;
  const y = py(172) + dy;
  return `M ${n(x - w / 2)} ${n(y)} L ${n(x - w / 6)} ${n(y - h)} L ${n(x + w / 2)} ${n(y - h * 0.3)} L ${n(x + w / 5)} ${n(y + h * 0.6)} Z`;
});

// ---- La ruta: los nueve capítulos, en orden ----
const LUGARES = CHAPTERS.map((c) => ({
  rune: c.rune,
  label: c.label,
  x: px(c.place[0]),
  y: py(c.place[1]),
}));

/**
 * La ruta, curvada, y en qué fracción del trazo cae cada punto.
 *
 * **Curvada** porque con segmentos rectos los nueve puntos se leen como un
 * polígono, y un polígono es una figura, no un camino. Catmull-Rom pasa por
 * todos los puntos exactamente y les redondea las esquinas, que es lo que hace
 * una línea trazada a mano sobre un mapa.
 *
 * **Y las fracciones** son lo que hace que los puntos se enciendan cuando la
 * línea los alcanza y no cada tanto: los tramos miden cosas muy distintas —del
 * barranco a Farum Azula hay cinco veces más que del Árbol a la capital—, así
 * que un `stagger` normal los deja desincronizados del trazo que los une.
 *
 * Se miden muestreando cada curva y no con la distancia en línea recta entre
 * los puntos: la curva es más larga que la recta, y ese sobrante se acumula
 * tramo a tramo hasta correr los últimos puntos varias décimas.
 */
const { ruta: RUTA, fraccion: FRACCION } = (() => {
  const t = 0.9; // tensión: más alto redondea más, y por encima de 1 se pasa
  const en = (i: number) => LUGARES[Math.min(LUGARES.length - 1, Math.max(0, i))];
  let d = `M ${n(LUGARES[0].x)} ${n(LUGARES[0].y)}`;
  const largos = [0];

  for (let i = 0; i < LUGARES.length - 1; i++) {
    const [a, b, c, e] = [en(i - 1), en(i), en(i + 1), en(i + 2)];
    const c1 = { x: b.x + ((c.x - a.x) / 6) * t, y: b.y + ((c.y - a.y) / 6) * t };
    const c2 = { x: c.x - ((e.x - b.x) / 6) * t, y: c.y - ((e.y - b.y) / 6) * t };
    d += ` C ${n(c1.x)} ${n(c1.y)}, ${n(c2.x)} ${n(c2.y)}, ${n(c.x)} ${n(c.y)}`;

    // Largo del tramo, a fuerza de muestrear la cúbica.
    let largo = 0;
    let ax = b.x;
    let ay = b.y;
    for (let s = 1; s <= 24; s++) {
      const u = s / 24;
      const m = 1 - u;
      const bx = m ** 3 * b.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u ** 3 * c.x;
      const by = m ** 3 * b.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u ** 3 * c.y;
      largo += Math.hypot(bx - ax, by - ay);
      ax = bx;
      ay = by;
    }
    largos.push(largos[i] + largo);
  }

  const total = largos[largos.length - 1] || 1;
  return { ruta: d, fraccion: largos.map((v) => v / total) };
})();

/** Dónde va el numeral de cada punto: hacia afuera del mapa. */
function rotulo(x: number, y: number) {
  const dx = x - CX;
  const dy = y - CY;
  const d = Math.hypot(dx, dy);
  // Los de cerca del centro no tienen "afuera" que valga, así que van arriba.
  if (d < 34) return { x, y: y - 15, anchor: 'middle' as const };
  return {
    x: x + (dx / d) * 17,
    y: y + (dy / d) * 17 + 3.5,
    anchor: (dx / d > 0.4 ? 'start' : dx / d < -0.4 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
  };
}

/**
 * Los nombres de los hitos, colocados a mano.
 *
 * El único criterio es que ninguno se cruce con el Anillo, con la ruta ni con
 * otro nombre, y eso depende de la forma del texto y no de una regla. En un
 * mapa de seis nombres, colocarlos a ojo es más corto que escribir el
 * algoritmo que los coloca mal.
 */
const ROTULOS = [
  // Los dos árboles van en dos líneas. Enteros no caben en ningún hueco: el
  // Áureo tiene el Anillo encima y la ruta debajo, y el Sagrado tiene el
  // tramo más largo de la ruta pasándole por al lado.
  { at: [px(6) - 30, py(-178) - 8], texto: 'El Árbol', segunda: 'Áureo', anchor: 'end' },
  { at: [px(-76), py(-90)], texto: 'Leyndell', anchor: 'end' },
  { at: [px(116), py(-18) - 40], texto: 'Caelid', anchor: 'middle' },
  { at: [px(47) - 16, py(60)], texto: 'El barranco', anchor: 'end' },
  { at: [px(30) - 24, py(172) + 6], texto: 'Farum Azula', anchor: 'end' },
  { at: [px(-138) + 10, py(72) + 40], texto: 'El Árbol', segunda: 'Sagrado', anchor: 'middle' },
] as const;

interface AtlasProps {
  armed: boolean;
  reduced: boolean;
  /** Suelta la cámara. Lo maneja App, que es quien sabe del scroll. */
  onSoltar: () => void;
}

export default function Atlas({ armed, reduced, onSoltar }: AtlasProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const scope = root.current;
      if (!armed || reduced || !scope) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          // Dos pantallas y media: hay mucho que dibujar y el trazo de la ruta
          // se lleva la mitad del tramo él solo.
          end: '+=250%',
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
        },
      });

      const q = gsap.utils.selector(scope);

      // 1. El marco: el Anillo, tres arcos que se dibujan a la vez desde su
      //    centro, así que el mapa se abre en tres bocas en vez de barrerse.
      tl.from(q('.atlas__anillo path'), {
        drawSVG: '50% 50%',
        duration: 0.22,
        stagger: 0.03,
        ease: 'power2.out',
      }, 0);

      // 2. La tierra: el borde de la llanura y la cordillera.
      tl.from(q('.atlas__llano'), { drawSVG: '0%', duration: 0.16, ease: 'none' }, 0.12)
        .from(q('.atlas__monte'), { opacity: 0, duration: 0.1, stagger: 0.004, ease: 'none' }, 0.14);

      // 3. Los hitos, de norte a sur, cada uno con su rótulo detrás.
      tl.from(q('.atlas__hito'), { opacity: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.14, stagger: 0.035, ease: 'back.out(1.6)' }, 0.26)
        .from(q('.atlas__rotulo'), { opacity: 0, duration: 0.1, stagger: 0.03, ease: 'none' }, 0.32);

      // 4. La ruta, que es la mitad del tramo, y los puntos encendiéndose
      //    justo cuando el trazo los alcanza.
      const INICIO = 0.42;
      const LARGO = 0.44;
      tl.from(q('.atlas__ruta'), { drawSVG: '0%', duration: LARGO, ease: 'none' }, INICIO);

      q('.atlas__punto').forEach((punto, i) => {
        tl.from(
          punto,
          { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.09, ease: 'back.out(2.4)' },
          INICIO + FRACCION[i] * LARGO,
        );
      });

      // 5. Y en cuanto el trazo llega al noveno, la invitación a quedarse.
      //    Justo ahí y no al final del tramo clavado: si aparece con el pin
      //    a punto de soltarse, la sección se va de pantalla antes de que a
      //    nadie le dé tiempo a leerla.
      tl.from(q('.atlas__soltar'), { opacity: 0, y: 14, duration: 0.1, ease: 'power2.out' }, 0.88);
    },
    { scope: root, dependencies: [armed, reduced] },
  );

  return (
    <section className="atlas" ref={root}>
      <div className="atlas__inner">
        {/* Encabezado de verdad y no un párrafo con pinta de tal: es la
            última sección de la página y quien navegue por títulos tiene
            que encontrarla. */}
        <h2 className="atlas__label">Las Tierras Intermedias</h2>

        <svg
          className="atlas__svg"
          viewBox="0 0 420 420"
          role="img"
          aria-label={`Mapa de las Tierras Intermedias con los nueve capítulos: ${LUGARES.map(
            (l) => `${l.rune}, ${l.label}`,
          ).join('; ')}.`}
          focusable="false"
        >
          {/* El marco: el Anillo, roto en tres */}
          <g className="atlas__anillo">
            {ANILLO.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>

          {/* La tierra */}
          <circle className="atlas__llano" cx={CX} cy={CY} r={78 * K} />
          <g className="atlas__montes">
            {MONTES.map((d) => (
              <path className="atlas__monte" key={d} d={d} />
            ))}
          </g>

          {/* Los hitos */}
          <g className="atlas__hito atlas__hito--arbol">
            <circle className="atlas__halo" cx={px(6)} cy={py(-178)} r={30} />
            <path className="atlas__copa" d={ARBOL_AUREO.copa} />
            {ARBOL_AUREO.ramas.map((d) => (
              <path key={d} d={d} />
            ))}
            <path d={ARBOL_AUREO.tronco} />
          </g>

          <g className="atlas__hito atlas__hito--capital">
            <path d={MURALLA} />
            {TORRES.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>

          <g className="atlas__hito atlas__hito--caelid">
            <path className="atlas__podrido" d={mancha(px(116), py(-18), 40, 17)} />
            <path className="atlas__podrido atlas__podrido--dentro" d={mancha(px(116), py(-18), 23, 41)} />
          </g>

          <g className="atlas__hito atlas__hito--barranco">
            <path d={BARRANCO} />
          </g>

          <g className="atlas__hito atlas__hito--azula">
            {AZULA.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>

          <g className="atlas__hito atlas__hito--sagrado">
            <path className="atlas__copa" d={ARBOL_SAGRADO.copa} />
            {ARBOL_SAGRADO.ramas.map((d) => (
              <path key={d} d={d} />
            ))}
            <path d={ARBOL_SAGRADO.tronco} />
          </g>

          {/* Los nombres */}
          <g className="atlas__rotulos">
            {ROTULOS.map((r) => (
              <text
                className="atlas__rotulo"
                // Los dos árboles empiezan igual, así que la primera línea no
                // alcanza para distinguirlos.
                key={r.texto + ('segunda' in r ? ` ${r.segunda}` : '')}
                x={r.at[0]}
                y={r.at[1]}
                textAnchor={r.anchor}
              >
                {r.texto}
                {'segunda' in r && (
                  <tspan x={r.at[0]} dy="11">
                    {r.segunda}
                  </tspan>
                )}
              </text>
            ))}
          </g>

          {/* La ruta y los nueve */}
          <path className="atlas__ruta" d={RUTA} />
          {LUGARES.map((l) => {
            const rot = rotulo(l.x, l.y);
            return (
              <g className="atlas__punto" key={l.rune}>
                <circle className="atlas__punto-aura" cx={l.x} cy={l.y} r={8.5} />
                <circle className="atlas__punto-nucleo" cx={l.x} cy={l.y} r={3.2} />
                <text className="atlas__numeral" x={rot.x} y={rot.y} textAnchor={rot.anchor}>
                  {l.rune}
                </text>
              </g>
            );
          })}
        </svg>

        <button className="atlas__soltar" type="button" onClick={onSoltar}>
          Soltar la cámara
        </button>
      </div>
    </section>
  );
}
