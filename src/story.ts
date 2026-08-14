// ============================================================
//  LA HISTORIA
// ------------------------------------------------------------
//  Todo el contenido vive acá: texto y recorrido de cámara.
//
//  El recorrido está hecho de "estaciones". Cada una es un punto
//  donde la cámara se detiene, y la cámara viaja interpolando
//  entre una y la siguiente.
//
//  Una estación no tiene por qué llevar texto. Las que no lo
//  llevan son respiros — el lector sigue bajando, el mundo sigue
//  moviéndose y no hay nada que leer. Sirven para dos cosas a la
//  vez: dejar respirar la lectura, y darle a la cámara puntos
//  intermedios por donde pasar. Con capítulos sueltos, el viaje
//  entre uno y otro es una recta larga que atraviesa el mundo sin
//  que nadie la conduzca.
//
//  EL ORDEN DE LOS CAPÍTULOS NO ES SOLO NARRATIVO. La cámara
//  arranca mirando al Árbol, al norte, y tiene que terminar
//  mirándolo otra vez. Cualquier capítulo que mire a otro lado
//  hay que pagarlo dos veces, a la ida y a la vuelta, y dos
//  vueltas de ciento ochenta grados se sienten como un latigazo.
//  Por eso los capítulos están ordenados de manera que el
//  recorrido dé una sola vuelta entera: norte, este, sur,
//  suroeste y de vuelta al norte. Girar trescientos sesenta
//  grados repartidos en dieciocho estaciones es más suave que ir
//  y venir dos veces.
//
//  Ojo con una cosa: los umbrales del mundo 3D (`world/mood.ts`)
//  están escritos en números de estación, así que agregar o
//  quitar estaciones en el medio corre todo lo que viene después.
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
  // ------------------------------------------------ 0 · al norte, el Árbol
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

  // ------------------------------------------------ 2
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

  // ------------------------------------------------ 4
  {
    camera: [-24, 4.5, 6],
    lookAt: [-16, 30, -110],
    frame: -12,
    chapter: {
      rune: 'III',
      label: 'Los Semidioses',
      title: 'Lo que quedó de los hijos',
      body: [
        'Godrick cosiéndose brazos ajenos para parecerse a un antepasado que no lo habría mirado. Rykard tragado por su propia serpiente. Morgott defendiendo hasta el final la capital que lo desterró por nacer.',
        'Ninguno ganó. Quien cruza las Tierras Intermedias aprende a leer las ruinas: cada una fue de alguien que también creía que iba a terminar la guerra.',
      ],
    },
  },
  // Respiro: empieza el giro hacia el este, de espaldas al Árbol.
  { camera: [-18, 5, 12], lookAt: [16, 14, -48], frame: 4 },

  // ------------------------------------------------ 6 · al este, Caelid
  {
    camera: [-10, 4, 8],
    lookAt: [52, 3, 2],
    frame: 9,
    chapter: {
      rune: 'IV',
      label: 'Caelid',
      title: 'El este se pudrió',
      body: [
        'Malenia y Radahn se midieron en Caelid, y cuando la Diosa de la Podredumbre entendió que no iba a ganar, abrió la flor. La podredumbre escarlata se comió la región en una tarde.',
        'Ganó, si a eso se le puede llamar ganar. Los dos siguen ahí: él sosteniendo las estrellas sin acordarse de por qué, ella durmiendo hasta que alguien la despierte.',
      ],
    },
  },
  // Respiro: se cruza la llanura hasta el borde del barranco y se mira abajo.
  { camera: [26, 4, 2], lookAt: [46, -10, 22], frame: 5 },

  // ------------------------------------------------ 8 · abajo, el barranco
  {
    camera: [45, -21, -23],
    lookAt: [47, -14, 3],
    frame: 5,
    chapter: {
      rune: 'V',
      label: 'Las raíces',
      title: 'Abajo sigue encendido',
      body: [
        'Debajo de la capital, donde ya no llega la Gracia, las raíces del Árbol siguen dando luz. No es fuego: no calienta y no se apaga.',
        'Los que bajaron a mirarlas volvieron diciendo lo mismo. Ahí abajo el Árbol está vivo, y no le importa quién gobierne arriba.',
      ],
    },
  },
  // Respiro: se sale del barranco hacia arriba, girando hacia el sur.
  { camera: [44, -12, -10], lookAt: [50, 10, 26], frame: 6 },

  // ------------------------------------------------ 10 · al sur, el cielo
  {
    camera: [-16, 6, -34],
    lookAt: [-3, 59, 182],
    frame: -33,
    chapter: {
      rune: 'VI',
      label: 'Farum Azula',
      title: 'Ninguna orden fue la primera',
      body: [
        'Sobre las nubes hay una ciudad que lleva mil años cayéndose y todavía no toca el suelo. Ahí el tiempo no corre: la tormenta no termina y las piedras se rompen sin terminar de romperse.',
        'En esa ciudad gobernó un señor antes que Marika, y su dios se fue un día sin avisar. Todavía lo espera. Ninguna orden fue la primera, y esta tampoco va a ser la última.',
      ],
    },
  },
  // Respiro: la mirada baja del cielo y sigue girando hacia el suroeste.
  { camera: [-26, 6, -22], lookAt: [-92, 34, 78], frame: -16 },

  // ------------------------------------------------ 12 · al suroeste, el otro árbol
  {
    camera: [-18, 6, -14],
    lookAt: [-120, 62, 97],
    frame: 15,
    chapter: {
      rune: 'VII',
      label: 'El Árbol Sagrado',
      title: 'El otro árbol',
      body: [
        'Miquella plantó un segundo árbol lejos del primero, para los que la Orden Áurea había dejado afuera: los omen, los malnacidos, todo lo que sobraba de un mundo perfecto.',
        'El Árbol Sagrado nunca llegó a florecer. Se quedó helado a media altura, y del refugio que iba a ser solo queda su hermana montando guardia en la puerta.',
      ],
    },
  },
  // Dos respiros para cerrar la vuelta: del suroeste al oeste...
  { camera: [-16, 7, -10], lookAt: [-96, 40, -18], frame: -14 },
  // ...y del oeste al norte, ya con el Árbol otra vez delante.
  { camera: [-6, 8, -16], lookAt: [-34, 58, -112], frame: -12 },

  // ------------------------------------------------ 15 · de vuelta al norte
  {
    camera: [4, 9, -30],
    lookAt: [26, 88, -156],
    frame: 20,
    chapter: {
      rune: 'VIII',
      label: 'La Llama',
      title: 'Hay que quemar el Árbol',
      body: [
        'El Árbol tiene la puerta cerrada por dentro. Las espinas no se cortan, no se apartan y no se pudren: no hay forma de entrar sin prenderle fuego a lo que sostenía el mundo.',
        'La llama existe, y hace falta alguien que la encienda. Encenderla cuesta una vida. Todos los que llegaron hasta acá tuvieron que decidir lo mismo.',
      ],
    },
  },
  // Respiro: se toma distancia mientras el Árbol se consume.
  { camera: [2, 9, 4], lookAt: [0, 64, -140], frame: -6 },

  // ------------------------------------------------ 17
  {
    camera: [-6, 6, 34],
    lookAt: [-10, 58, -130],
    frame: -10,
    chapter: {
      rune: 'IX',
      label: 'El Sinluz',
      title: 'La Gracia señala, no promete',
      body: [
        'Las Tierras Intermedias no fueron restauradas ni terminaron de caer. El Árbol ardió y sigue en pie, el Anillo sigue roto: se quedaron a medias, que es una manera de seguir esperando.',
        'A los que vuelven de la muerte los llaman Sinluz, y el camino se lo marca un hilo de luz dorada. Que lleve a alguna parte ya es cosa tuya.',
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

/**
 * De qué lado de la pantalla va cada capítulo, alternando.
 *
 * Se cuenta por capítulo y no por estación: los respiros no están
 * repartidos de forma pareja —el tramo del suroeste al norte lleva dos
 * seguidos— y contando estaciones la serie se corre y salen dos capítulos
 * del mismo lado.
 */
export const ALIGN = new Map(
  CHAPTERS.map((chapter, order) => [chapter.index, order % 2 === 0 ? 'left' : 'right'] as const),
);
