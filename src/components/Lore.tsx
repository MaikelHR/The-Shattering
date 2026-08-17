import { useEffect, useRef } from 'react';
import { GRACIAS } from '../story';
import type { Grace } from '../story';

/**
 * LAS NOTAS AL MARGEN
 * ------------------------------------------------------------
 * Dos piezas: las cuatro marcas doradas repartidas por el mundo, y la ficha
 * que se abre al pulsar una.
 *
 * Las marcas son botones normales, colocados en cada frame por `Graces.tsx`
 * desde dentro del canvas (ahí está explicado por qué no son geometría).
 * Aquí solo se declaran, apagados: hasta que el mundo 3D no los coloca, no
 * tienen sitio en la pantalla y no deben ni verse ni recibir el foco.
 *
 * La ficha se abre en el medio, con el mundo atenuado detrás. Es lo que hace
 * el juego cuando uno levanta un objeto y se pone a leerlo, y acá además
 * evita el único problema de ponerla a un lado: el bloque de texto de los
 * capítulos va alternando de lado, así que cualquier posición fija choca con
 * la mitad de ellos.
 */

interface LoreProps {
  /** La nota abierta, si hay alguna. */
  open: Grace | null;
  onOpen: (grace: Grace) => void;
  onClose: () => void;
}

export default function Lore({ open, onOpen, onClose }: LoreProps) {
  const panel = useRef<HTMLDivElement>(null);
  /** Desde qué marca se abrió, para devolverle el foco al cerrar. */
  const origen = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // El foco entra en la ficha. Sin esto, quien navega con teclado abre la
    // nota y se queda con el foco en un botón que ahora está detrás de una
    // capa oscura: no puede leerla ni sabe que se abrió.
    panel.current?.focus();

    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [open, onClose]);

  // Y al cerrar vuelve a la marca de la que salió, que es donde estaba.
  useEffect(() => {
    if (open || !origen.current) return;
    origen.current.focus();
    origen.current = null;
  }, [open]);

  return (
    <>
      <div className="gracias">
        {GRACIAS.map((grace) => (
          <button
            key={grace.id}
            data-gracia={grace.id}
            className="gracia"
            type="button"
            onClick={(e) => {
              origen.current = e.currentTarget;
              onOpen(grace);
            }}
            aria-label={`Nota: ${grace.label}`}
          >
            <span className="gracia__luz" aria-hidden="true" />
            {/* El nombre al pasar por encima. Sin él, una luz dorada en un
                paisaje lleno de luces doradas es paisaje: nada dice que se
                pueda pulsar. Va con `aria-hidden` porque el botón ya lleva
                el mismo texto en su etiqueta y si no se anunciaría dos
                veces. */}
            <span className="gracia__nombre" aria-hidden="true">
              {grace.label}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="lore" role="presentation">
          {/* El fondo cierra al pulsarlo, que es lo que todo el mundo intenta.
              No lleva rol ni foco: la salida de verdad es el botón y Escape. */}
          <div className="lore__fondo" onClick={onClose} />

          <div
            className="lore__ficha"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lore-titulo"
            tabIndex={-1}
          >
            <p className="lore__label">{open.label}</p>
            <h2 className="lore__titulo" id="lore-titulo">
              {open.title}
            </h2>
            {open.body.map((p, i) => (
              <p className="lore__parrafo" key={i}>
                {p}
              </p>
            ))}
            <button className="lore__cerrar" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
