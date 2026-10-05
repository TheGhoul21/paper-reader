import { useId } from "react";
import type { useFigurePlayback } from "../../lib/useFigurePlayback";

export default function FigurePlayback({
  playback,
  total,
  label,
}: {
  playback: ReturnType<typeof useFigurePlayback>;
  total: number;
  label: string;
}) {
  const id = useId();
  const { step, playing, goTo, toggle } = playback;
  return (
    <>
      <div className="twine-playback" role="group" aria-label="Comandi animazione">
        <button onClick={toggle}>
          {playing ? "Pausa" : step === total ? "Riproduci dall’inizio" : "Riproduci"}
        </button>
        <button disabled={step === 0} onClick={() => goTo(step - 1)}>
          Indietro
        </button>
        <button disabled={step === total} onClick={() => goTo(step + 1)}>
          Avanti
        </button>
        <button disabled={step === 0 && !playing} onClick={() => goTo(0)}>
          Ricomincia
        </button>
      </div>
      <label className="twine-timeline" htmlFor={id}>
        Passaggio {step} / {total}
        <input
          id={id}
          aria-label={label}
          type="range"
          min="0"
          max={total}
          value={step}
          onChange={(e) => goTo(Number(e.target.value))}
        />
      </label>
    </>
  );
}
