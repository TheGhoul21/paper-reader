import { useId, useState } from "react";
import { OQFT_STAGES, oqftStage } from "../../lib/oqftBlocks";
import { useFigurePlayback } from "../../lib/useFigurePlayback";
import FigurePlayback from "./FigurePlayback";

const OPERATION_NAMES = {
  initial: "Configurazione iniziale",
  qft: "Ordine logico · QFT",
  inverse: "Ordine logico · QFT†",
  transport: "Spostamento fisico di una colonna",
};
export default function OqftBlocksFigure() {
  const playback = useFigurePlayback(OQFT_STAGES.length - 1, 2200);
  const [selected, setSelected] = useState("A");
  const state = oqftStage(playback.step);
  const titleId = useId();
  const transportStep = [
    [2, 3],
    [4, 5],
  ].find(
    ([from, to]) =>
      (playback.previousStep === from && playback.step === to) ||
      (playback.previousStep === to && playback.step === from),
  );
  const movedBlocks = transportStep ? oqftStage(transportStep[1]).active : [];
  return (
    <div className="oqft-animation">
      <p className="figure-description">
        Parte (a) · Quattro blocchi da quattro qubit, come nell’esempio originale. I colori e i
        numeri seguono le etichette logiche. Solo t₂ → t₃ e t₄ → t₅ sono trasporti fisici.
      </p>
      <ol className="figure-stage-tabs" aria-label="Passaggi della figura 7">
        {OQFT_STAGES.map((s, i) => (
          <li key={i}>
            <button
              aria-pressed={playback.step === i}
              onClick={() => playback.goTo(i)}
              title={s.title}
            >
              t{["₀", "₁", "₂", "₃", "₄", "₅"][i]}
            </button>
          </li>
        ))}
      </ol>
      <div className="oqft-drawing">
        <svg viewBox="0 0 470 380" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            {state.title}.{" "}
            {state.blocks
              .map(
                (b) =>
                  `Blocco ${b.id}: colonna ${b.column + 1}, riga ${b.row + 2}, etichette ${b.labels.join(", ")}.`,
              )
              .join(" ")}
          </title>
          {[0, 1, 2].flatMap((column) =>
            [-1, 0, 1].map((row) => (
              <rect
                key={`${column}-${row}`}
                x={20 + column * 150}
                y={12 + (row + 1) * 120}
                width="130"
                height="108"
                rx="6"
                className="oqft-slot"
              />
            )),
          )}
          {state.blocks.map((b) => (
            <g
              key={b.id}
              className={`oqft-block oqft-block-${b.id}${selected === b.id ? " is-selected" : ""}${state.active.includes(b.id) ? " is-active" : ""}${movedBlocks.includes(b.id) ? " is-transported" : ""}`}
              style={{
                transform: `translate(${20 + b.column * 150}px,${12 + (b.row + 1) * 120}px)`,
              }}
            >
              <rect width="130" height="108" rx="6" />
              <text x="12" y="22" className="oqft-block-title">
                Blocco {b.id}
              </text>
              {b.labels.map((n, i) => (
                <g key={i}>
                  <circle cx={42 + (i % 2) * 50} cy={49 + Math.floor(i / 2) * 40} r="15" />
                  <text x={42 + (i % 2) * 50} y={54 + Math.floor(i / 2) * 40} textAnchor="middle">
                    {n}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="oqft-block-selector" role="group" aria-label="Segui un blocco">
        {state.blocks.map((b) => (
          <button
            key={b.id}
            className={`oqft-color-${b.id}`}
            aria-pressed={selected === b.id}
            onClick={() => setSelected(b.id)}
          >
            Blocco {b.id}
          </button>
        ))}
      </div>
      <p className="figure-description">
        A e C hanno i numeri locali 1–4, B e D i numeri 5–8. Le caselle vuote rendono visibili le
        traslazioni; le distanze del disegno sono schematiche.
      </p>
      <FigurePlayback
        playback={playback}
        total={OQFT_STAGES.length - 1}
        label="Passaggio del riordino"
      />
      <div className="twine-state" role="status" aria-live={playback.playing ? "off" : "polite"}>
        <strong>{state.title}</strong>
        <p className="figure-operation">{OPERATION_NAMES[state.operation]}</p>
        <p>{state.description}</p>
        <p className="oqft-selected-state">
          Blocco {selected}: {state.blocks.find((b) => b.id === selected)!.labels.join(" · ")} (riga
          superiore, poi inferiore).
        </p>
        {playback.step === 5 && (
          <p className="oqft-final-order">
            Ordine finale: B–A nella prima riga, D–C nella seconda. Rimane l’inversione
            sinistra–destra; il paper indica come gestirla nelle operazioni successive.
          </p>
        )}
      </div>
      <p className="figure-description">
        La parte (b), con le stime di fedeltà, resta nel grafico originale qui sotto.
      </p>
    </div>
  );
}
