// ============================================================
//  LA HISTORIA
// ------------------------------------------------------------
//  Todo el contenido vive acá: texto y posiciones de cámara.
//  Para reescribir la historia o cambiar el recorrido de la
//  cámara, editás este archivo y nada más.
//
//  El recorrido cuenta el arco solo: se empieza lejos, mirando
//  el Árbol entero; se sube y se rodea cuando el mundo se
//  rompe; se baja hasta las raíces; y se vuelve a salir.
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
  /** Dónde está la cámara cuando este capítulo empieza. */
  camera: [number, number, number];
  /** Hacia dónde mira la cámara. */
  lookAt: [number, number, number];
  /**
   * Cuánto de `lookAt.x` es corrimiento de composición: lo que se desplaza
   * la mirada para dejar al sujeto en el lado contrario al texto. En una
   * pantalla vertical no hay ancho para ese lujo, y CameraRig lo va
   * devolviendo al centro a medida que la ventana se angosta.
   */
  frame: number;
}

export const CHAPTERS: Chapter[] = [
  {
    rune: 'I',
    label: 'La Orden',
    title: 'Todo estaba bajo el Árbol',
    body: [
      'Durante una era el Anillo de Elden sostuvo el mundo, y el Árbol Áureo repartió su luz sin que nadie se molestara en preguntar de dónde salía.',
      'Los cartógrafos dibujaban las Tierras Intermedias con el Árbol en el centro. El centro no se discutía.',
    ],
    camera: [0, 4.2, 25],
    lookAt: [-6, 5.4, 0],
    frame: -6,
  },
  {
    rune: 'II',
    label: 'La Fractura',
    title: 'Y Marika lo rompió',
    body: [
      'No hubo advertencia. La Reina Eterna quebró el Anillo con sus propias manos, y las Grandes Runas quedaron repartidas entre hijos que no entendían qué tenían.',
      'Lo que siguió fue una guerra. Los mapas la llamaron la Fractura, como si nombrarla alcanzara para explicarla.',
    ],
    camera: [14, 14, 22],
    lookAt: [3, 10.5, -6],
    frame: 3,
  },
  {
    rune: 'III',
    label: 'Los Semidioses',
    title: 'Lo que quedó de los hijos',
    body: [
      'Godrick cosiéndose brazos ajenos. Rykard tragado por su propia serpiente. Malenia entera y podrida en las raíces de un árbol que no era este. Ninguno ganó.',
      'Quien cruza las Tierras Intermedias aprende a leer las ruinas: cada una fue de alguien que también creía que iba a terminar la guerra.',
    ],
    camera: [-16, 0.6, 13],
    lookAt: [-4.5, 3.2, 0],
    frame: -4.5,
  },
  {
    rune: 'IV',
    label: 'Las raíces',
    title: 'Abajo sigue encendido',
    body: [
      'Debajo de la capital, donde ya no llega la Gracia, las raíces del Árbol siguen dando luz. No es fuego: no calienta y no se apaga.',
      'Los que bajaron a mirarlas volvieron diciendo lo mismo. Ahí abajo el Árbol está vivo, y no le importa quién gobierne arriba.',
    ],
    camera: [5, -7, 6.5],
    lookAt: [1.5, -4.4, 0],
    frame: 1.5,
  },
  {
    rune: 'V',
    label: 'Ahora',
    title: 'La Gracia señala, no promete',
    body: [
      'Las Tierras Intermedias no fueron restauradas ni terminaron de caer. Se quedaron rotas, que es una manera de seguir esperando.',
      'El camino lo marca un hilo de luz dorada. Que lleve a alguna parte ya es cosa tuya.',
    ],
    camera: [0, 13, 27],
    lookAt: [-3.4, 4.5, 0],
    frame: -3.4,
  },
];
