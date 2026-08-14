// ============================================================
//  LA HISTORIA
// ------------------------------------------------------------
//  Todo el contenido vive acá: texto y recorrido de cámara.
//
//  El recorrido está hecho de "estaciones". Cada una es un punto
//  donde la cámara se detiene, y la cámara viaja interpolando
//  entre una y la siguiente.
//
//  Lo importante: una estación no tiene por qué llevar texto.
//  Las que no lo llevan son respiros — el lector sigue bajando,
//  el mundo sigue moviéndose y no hay nada que leer. Sirven para
//  dos cosas a la vez: dejar respirar la lectura, y darle a la
//  cámara puntos intermedios por donde pasar. Con cinco puntos
//  sueltos, el viaje entre uno y otro es una recta larga que
//  atraviesa el mundo sin que nadie la conduzca.
//
//  Para cambiar el recorrido, este archivo y nada más.
// ============================================================

export interface Chapter {
  /** Marca corta que aparece en el riel lateral. Se usa como key: única. */
  rune: string;
  /** Etiqueta del capítulo. */
  label: string;
  /** Título grande. */
  title: string;
  /** Uno o dos párrafos. */
  body: string[];
}

export interface Beat {
  /** Dónde está la cámara en esta estación. */
  camera: [number, number, number];
  /** Hacia dónde mira. */
  lookAt: [number, number, number];
  /**
   * Cuánto de `lookAt.x` es corrimiento de composición: lo que se desplaza
   * la mirada para dejar al sujeto en el lado contrario al texto. En una
   * pantalla vertical no hay ancho para ese lujo, y CameraRig lo va
   * devolviendo al centro a medida que la ventana se angosta.
   */
  frame: number;
  /** Si falta, la estación es un respiro: se ve el mundo y no hay texto. */
  chapter?: Chapter;
}

export const BEATS: Beat[] = [
  {
    camera: [4, 7.5, 30],
    lookAt: [-14, 52, -120],
    frame: -14,
    chapter: {
      rune: 'I',
      label: 'La Orden',
      title: 'Todo estaba bajo el Árbol',
      body: [
        'Durante una era el Anillo de Elden sostuvo el mundo, y el Árbol Áureo repartió su luz sin que nadie se molestara en preguntar de dónde salía.',
        'Los cartógrafos dibujaban las Tierras Intermedias con el Árbol en el centro. El centro no se discutía.',
      ],
    },
  },
  // Respiro: se avanza hacia el norte y la vista se levanta.
  { camera: [10, 11, 16], lookAt: [2, 60, -130], frame: -2 },
  {
    camera: [24, 9, 22],
    lookAt: [22, 96, -150],
    frame: 10,
    chapter: {
      rune: 'II',
      label: 'La Fractura',
      title: 'Y Marika lo rompió',
      body: [
        'No hubo advertencia. La Reina Eterna quebró el Anillo con sus propias manos, y las Grandes Runas quedaron repartidas entre hijos que no entendían qué tenían.',
        'Lo que siguió fue una guerra. Los mapas la llamaron la Fractura, como si nombrarla alcanzara para explicarla.',
      ],
    },
  },
  // Respiro: la cámara baja de la altura y se mete entre las ruinas.
  { camera: [4, 6, 6], lookAt: [-6, 30, -110], frame: -4 },
  {
    camera: [-24, 4.5, 6],
    lookAt: [-16, 30, -110],
    frame: -12,
    chapter: {
      rune: 'III',
      label: 'Los Semidioses',
      title: 'Lo que quedó de los hijos',
      body: [
        'Godrick cosiéndose brazos ajenos. Rykard tragado por su propia serpiente. Malenia entera y podrida en las raíces de un árbol que no era este. Ninguno ganó.',
        'Quien cruza las Tierras Intermedias aprende a leer las ruinas: cada una fue de alguien que también creía que iba a terminar la guerra.',
      ],
    },
  },
  // Respiro: se cruza la llanura hacia el este, hacia el borde del barranco.
  { camera: [6, 5, 22], lookAt: [34, 0, 10], frame: 6 },
  {
    camera: [45, -21, 27],
    lookAt: [43, -12, -2],
    frame: 3,
    chapter: {
      rune: 'IV',
      label: 'Las raíces',
      title: 'Abajo sigue encendido',
      body: [
        'Debajo de la capital, donde ya no llega la Gracia, las raíces del Árbol siguen dando luz. No es fuego: no calienta y no se apaga.',
        'Los que bajaron a mirarlas volvieron diciendo lo mismo. Ahí abajo el Árbol está vivo, y no le importa quién gobierne arriba.',
      ],
    },
  },
  // Respiro: se sale del barranco y el mundo vuelve a abrirse.
  { camera: [36, -2, 30], lookAt: [10, 30, -100], frame: 4 },
  {
    camera: [-6, 6, 34],
    lookAt: [-10, 58, -130],
    frame: -10,
    chapter: {
      rune: 'V',
      label: 'Ahora',
      title: 'La Gracia señala, no promete',
      body: [
        'Las Tierras Intermedias no fueron restauradas ni terminaron de caer. Se quedaron rotas, que es una manera de seguir esperando.',
        'El camino lo marca un hilo de luz dorada. Que lleve a alguna parte ya es cosa tuya.',
      ],
    },
  },
];

/**
 * Los capítulos con texto, con el índice de la estación en la que viven.
 * Lo usa el riel: los respiros no aparecen ahí, porque no son sitios a los
 * que uno quiera saltar.
 */
export const CHAPTERS = BEATS.map((beat, index) => ({ ...beat.chapter, index })).filter(
  (entry): entry is Chapter & { index: number } => entry.rune !== undefined,
);
