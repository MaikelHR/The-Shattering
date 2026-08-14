import { CHAPTERS } from '../story';

interface ChapterRailProps {
  active: number;
  onSelect: (index: number) => void;
}

/**
 * Elemento de firma: el riel de capítulos.
 *
 * Marca dónde estás en la historia y deja saltar a cualquier capítulo.
 * El estado activo viene de App con estado de React porque cambia pocas
 * veces (una por capítulo), no en cada frame: ahí sí conviene el estado.
 *
 * Son botones de verdad, no adornos: un <nav> con elementos inertes no
 * es navegación para nadie que use teclado o lector de pantalla.
 */
export default function ChapterRail({ active, onSelect }: ChapterRailProps) {
  return (
    <nav className="rail" aria-label="Capítulos">
      <span className="rail__line" aria-hidden="true" />
      <ol className="rail__list">
        {CHAPTERS.map((c, i) => (
          <li key={c.rune} className={`rail__item ${i === active ? 'is-active' : ''}`}>
            <button
              type="button"
              className="rail__link"
              onClick={() => onSelect(c.index)}
              aria-label={`Capítulo ${c.rune}: ${c.label}`}
              aria-current={i === active ? 'true' : undefined}
            >
              <span className="rail__rune" aria-hidden="true">
                {c.rune}
              </span>
              <span className="rail__label" aria-hidden="true">
                {c.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
