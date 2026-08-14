import { useEffect, useRef, useState } from 'react';
import { scrollState } from '../scrollState';
import { roots, shock } from '../world/mood';

/**
 * EL SONIDO
 * ------------------------------------------------------------
 * Viento, el zumbido de las raíces y un golpe en la Fractura.
 *
 * **Todo sintetizado, ni un archivo.** Es la misma decisión que
 * gobierna el resto del proyecto —el Árbol, el terreno y las
 * ruinas también se calculan— y acá además sale casi gratis: el
 * viento es ruido filtrado, el zumbido son dos senos desafinados
 * entre sí y el golpe es un barrido grave. Cero kilobytes de
 * descarga contra los ciento cincuenta que costaría un bucle en
 * opus, y se ajusta a la historia en vez de repetirse igual.
 *
 * **Arranca apagado.** No es timidez con el autoplay —que también,
 * el navegador no deja sonar nada hasta que el visitante toca la
 * página—: es que una página que suena sola sin avisar es una
 * grosería. El botón queda abajo a la derecha y la elección se
 * recuerda.
 *
 * El grafo, de una vez:
 *
 *   ruido ──▶ pasa-banda ──▶ ganancia ─┐
 *   seno+seno ──▶ ganancia ────────────┼──▶ maestra ──▶ salida
 *   golpe (se crea y se tira) ─────────┘
 */

const CLAVE = 'tierras-intermedias:sonido';

/** Ruido rosa aproximado, que suena mucho más a viento que el blanco. */
function ruido(ctx: AudioContext): AudioBuffer {
  const segundos = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  // Filtro de Voss-McCartney simplificado: sumar varios blancos con
  // memoria da una caída de 3 dB por octava, que es el ruido rosa.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < datos.length; i++) {
    const blanco = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + blanco * 0.099;
    b1 = 0.963 * b1 + blanco * 0.288;
    b2 = 0.57 * b2 + blanco * 1.022;
    datos[i] = (b0 + b1 + b2 + blanco * 0.1848) * 0.16;
  }
  return buffer;
}

interface Motor {
  ctx: AudioContext;
  maestra: GainNode;
  vientoGain: GainNode;
  vientoFiltro: BiquadFilterNode;
  raices: GainNode;
  parar: () => void;
}

function encender(): Motor {
  const ctx = new AudioContext();

  const maestra = ctx.createGain();
  maestra.gain.value = 0;
  maestra.connect(ctx.destination);

  // ---- El viento ----
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido(ctx);
  fuente.loop = true;

  const vientoFiltro = ctx.createBiquadFilter();
  vientoFiltro.type = 'bandpass';
  vientoFiltro.frequency.value = 420;
  vientoFiltro.Q.value = 0.7;

  const vientoGain = ctx.createGain();
  vientoGain.gain.value = 0.5;

  fuente.connect(vientoFiltro).connect(vientoGain).connect(maestra);
  fuente.start();

  // El vaivén: dos osciladores lentísimos y desincronizados moviendo la
  // frecuencia del filtro. Con uno solo, el viento respira como un metrónomo.
  for (const [hz, amplitud] of [
    [0.043, 190],
    [0.017, 120],
  ]) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const prof = ctx.createGain();
    prof.gain.value = amplitud;
    lfo.connect(prof).connect(vientoFiltro.frequency);
    lfo.start();
  }

  // ---- El zumbido de las raíces ----
  const raices = ctx.createGain();
  raices.gain.value = 0;
  raices.connect(maestra);
  for (const hz of [55, 55.4, 82.5]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const g = ctx.createGain();
    // El armónico va mucho más bajo: da cuerpo sin volverlo un zumbador.
    g.gain.value = hz > 70 ? 0.16 : 0.5;
    osc.connect(g).connect(raices);
    osc.start();
  }

  return {
    ctx,
    maestra,
    vientoGain,
    vientoFiltro,
    raices,
    parar: () => void ctx.close(),
  };
}

/** El golpe de la Fractura: un barrido grave y un soplo de ruido. */
function golpe(m: Motor) {
  const { ctx } = m;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  osc.connect(g).connect(m.maestra);
  osc.start(t);
  osc.stop(t + 1.7);

  const soplo = ctx.createBufferSource();
  soplo.buffer = ruido(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2200, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + 0.9);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.55, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  soplo.connect(lp).connect(sg).connect(m.maestra);
  soplo.start(t);
  soplo.stop(t + 1.3);
}

export default function Ambience({ reduced }: { reduced: boolean }) {
  const [on, setOn] = useState(false);
  const motor = useRef<Motor | null>(null);
  const golpeado = useRef(false);

  // Se recuerda la elección, pero **nunca se enciende sola al cargar**: el
  // navegador no dejaría, y aunque dejara tampoco estaría bien.
  useEffect(() => {
    if (localStorage.getItem(CLAVE) === 'on') setOn(true);
  }, []);

  useEffect(() => {
    if (!on) {
      motor.current?.parar();
      motor.current = null;
      return;
    }
    const m = encender();
    motor.current = m;
    // Entra despacio: de golpe asusta.
    m.maestra.gain.setTargetAtTime(reduced ? 0.1 : 0.16, m.ctx.currentTime, 1.2);

    // Un `AudioContext` puede nacer suspendido, y nace suspendido justo en el
    // caso que importa: alguien que dejó el sonido puesto y **recarga**. Ahí
    // el componente lo enciende solo, sin que nadie haya tocado la página, y
    // el navegador —con razón— no lo deja sonar. Sin esto, el botón diría que
    // está encendido y no se oiría nada.
    let despertar: (() => void) | null = null;
    if (m.ctx.state === 'suspended') {
      despertar = () => void m.ctx.resume();
      window.addEventListener('pointerdown', despertar, { once: true });
      window.addEventListener('keydown', despertar, { once: true });
      window.addEventListener('wheel', despertar, { once: true, passive: true });
    }

    return () => {
      if (despertar) {
        window.removeEventListener('pointerdown', despertar);
        window.removeEventListener('keydown', despertar);
        window.removeEventListener('wheel', despertar);
      }
      m.parar();
      motor.current = null;
    };
  }, [on, reduced]);

  // El sonido sigue a la historia igual que el mundo 3D: leyendo `mood.ts`.
  // No hace falta un bucle propio, con mirar de vez en cuando alcanza —el
  // oído no distingue diez actualizaciones por segundo de sesenta.
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      const m = motor.current;
      if (!m || m.ctx.state !== 'running') return;
      const t = m.ctx.currentTime;
      const pos = scrollState.position;

      // Las raíces zumban cuando se encienden.
      m.raices.gain.setTargetAtTime(roots(pos) * 0.4, t, 0.4);

      // Y el viento aprieta un poco cuando se baja rápido.
      const prisa = Math.min(1, Math.abs(scrollState.velocity) / 2600);
      m.vientoGain.gain.setTargetAtTime(0.4 + prisa * 0.45, t, 0.5);

      // El golpe de la Fractura, una sola vez por pasada.
      if (shock.value > 0.55 && !golpeado.current) {
        golpeado.current = true;
        golpe(m);
      }
      if (shock.value < 0.2) golpeado.current = false;
    }, 100);
    return () => window.clearInterval(id);
  }, [on]);

  return (
    <button
      type="button"
      className={`sonido ${on ? 'is-on' : ''}`}
      onClick={() => {
        const siguiente = !on;
        setOn(siguiente);
        localStorage.setItem(CLAVE, siguiente ? 'on' : 'off');
      }}
      aria-pressed={on}
      aria-label={on ? 'Silenciar el sonido' : 'Activar el sonido'}
      title={on ? 'Silenciar' : 'Sonido'}
    >
      {/* Tres arcos que son a la vez un altavoz y el Anillo. Cuando está
          apagado solo queda el primero. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
        <path className="sonido__onda" d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        <path className="sonido__onda" d="M18.2 6.6a7.8 7.8 0 0 1 0 10.8" />
      </svg>
    </button>
  );
}
