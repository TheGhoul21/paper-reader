import { useId, useState, type CSSProperties } from "react";
import {
  TRANSPORT_STAGES,
  TRANSPORT_PARAMETERS,
  transportStage,
  transportDistance,
  type TransportProtocol,
} from "../../lib/atomTransport";
import { useFigurePlayback } from "../../lib/useFigurePlayback";
import FigurePlayback from "./FigurePlayback";

const SITE_Y = { upper: 100, near: 154, lower: 310 };
export default function AtomTransportFigure({
  initialPanel = "a",
}: {
  initialPanel?: "a" | "b" | "c";
}) {
  const [protocol, setProtocol] = useState<TransportProtocol>(
    initialPanel === "b" ? "czswap" : "cz",
  );
  const total = TRANSPORT_STAGES[protocol].length - 1;
  const playback = useFigurePlayback(total, 1800);
  const state = transportStage(protocol, playback.step);
  const previous = transportStage(protocol, playback.previousStep);
  const titleId = useId();
  const params = TRANSPORT_PARAMETERS;
  return (
    <div className="transport-animation">
      <div className="twine-panels" role="group" aria-label="Protocollo della figura 8">
        {(["cz", "czswap"] as const).map((p) => (
          <button
            key={p}
            aria-pressed={protocol === p}
            onClick={() => {
              setProtocol(p);
              playback.goTo(0);
            }}
          >
            {p === "cz" ? "(a) CZ" : "(b) CZSWAP"}
          </button>
        ))}
      </div>
      <p className="figure-description">
        Sequenza dell’Appendice A. La CZ riporta A nella sua zona; la CZSWAP usa il ritorno per
        portare B nella zona di A. Nella parte (a), il CZ avviene direttamente tra AOD e SLM, senza
        depositare A prima dell’interazione.
      </p>
      <div className="transport-drawing">
        <svg viewBox="0 0 460 410" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            {state.title}. Atomo A: {state.A.trap},{" "}
            {state.A.site === "lower" ? "zona iniziale di A" : "zona di B"}. Atomo B: {state.B.trap}
            , {state.B.site === "lower" ? "zona iniziale di A" : "zona di B"}.
          </title>
          <text x="30" y="34">
            Trappole statiche · SLM
          </text>
          <text x="30" y="302" className="transport-zone-label">
            <tspan x="30">Zona iniziale</tspan>
            <tspan x="30" dy="26">
              di A
            </tspan>
          </text>
          <text x="30" y="98" className="transport-zone-label">
            <tspan x="30">Zona iniziale</tspan>
            <tspan x="30" dy="26">
              di B
            </tspan>
          </text>
          <line x1="225" y1="84" x2="225" y2="345" className="transport-track" />
          {[76, 100, 154, 286, 310, 338].map((y) => (
            <circle key={y} cx="225" cy={y} r="19" className="transport-trap" />
          ))}
          {state.interacting && (
            <rect x="187" y="80" width="76" height="96" rx="34" className="transport-interaction" />
          )}
          <path d="M 272 305 L 300 305 L 300 155 L 272 155" className="transport-path" />
          <text x="314" y="238" className="transport-path-label">
            Viaggio
          </text>
          <text x="314" y="257" className="transport-path-label">
            lungo
          </text>
          {(["A", "B"] as const).map((atom) => {
            const a = state[atom];
            const moving =
              Math.abs(playback.step - playback.previousStep) === 1 &&
              a.site !== previous[atom].site &&
              a.trap === "AOD";
            return (
              <g
                key={`${atom}-${protocol}-${playback.step}`}
                className={`transport-atom transport-atom-${atom}${a.trap === "AOD" ? " is-mobile" : ""}${moving ? " is-moving" : ""}`}
                style={
                  {
                    transform: `translate(225px,${SITE_Y[a.site]}px)`,
                    "--atom-from-y": `${SITE_Y[previous[atom].site]}px`,
                    "--atom-to-y": `${SITE_Y[a.site]}px`,
                  } as CSSProperties
                }
              >
                <circle r="15" />
                {a.trap === "AOD" && <circle r="23" className="transport-mobile-trap" />}
                <text y="6" textAnchor="middle">
                  {atom}
                </text>
              </g>
            );
          })}
          {state.interacting && (
            <text x="275" y="118" className="transport-cz-label">
              CZ
            </text>
          )}
        </svg>
      </div>
      <ul className="twine-legend" aria-label="Legenda delle trappole">
        <li>○ Trappola statica SLM</li>
        <li className="transport-mobile-legend">◌ Anello rosso: trappola mobile AOD</li>
      </ul>
      <FigurePlayback playback={playback} total={total} label="Passaggio del trasporto" />
      <div className="twine-state" role="status" aria-live={playback.playing ? "off" : "polite"}>
        <strong>{state.title}</strong>
        <p>{state.description}</p>
        <dl className="transport-atom-state">
          {(["A", "B"] as const).map((atom) => (
            <div key={atom}>
              <dt>Atomo {atom}</dt>
              <dd>
                {state[atom].trap} ·{" "}
                {state[atom].site === "lower" ? "zona iniziale A" : "zona iniziale B"}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="transport-counts">
          <div>
            <dt>CZ applicati</dt>
            <dd>{state.czGates}</dd>
          </div>
          <div>
            <dt>Trasferimenti SLM ↔ AOD</dt>
            <dd>{state.transfers}</dd>
          </div>
          <div>
            <dt>Viaggi lunghi</dt>
            <dd>{state.bigMoves}</dd>
          </div>
          <div>
            <dt>Offset nel modello</dt>
            <dd>{state.offsetMoves}</dd>
          </div>
          <div>
            <dt>Distanza totale nel modello</dt>
            <dd>{transportDistance(state)} µm</dd>
          </div>
        </dl>
        {playback.step === total && (
          <p className="transport-final-state">
            {protocol === "cz"
              ? "Posizioni finali: A nella zona di A, B nella zona di B."
              : "Posizioni finali: B nella zona di A, A nella zona di B."}
          </p>
        )}
      </div>
      <details className="figure-model-details">
        <summary>Distanze e confronto per una DCNOT</summary>
        <p>
          Parametri del paper: separazione iniziale {params.initialDistance} µm, distanza di
          interazione {params.interactionDistance} µm, offset {params.offsetDistance} µm. Un viaggio
          lungo vale 15 − 3 = 12 µm.
        </p>
        <p>
          Una CZ percorre 2 × 12 = 24 µm; una CZSWAP 2 × 12 + 4 × 2 = 32 µm. I passaggi della figura
          raggruppano i brevi offset; il disegno non è in scala e la riproduzione non misura il
          tempo fisico.
        </p>
        <p>
          Per realizzare una DCNOT, due CZ eseguite indipendentemente richiedono due interazioni e
          48 µm; la decomposizione CZSWAP richiede una interazione e 32 µm, più le rotazioni locali
          previste dalla figura 1(b). Il risultato dipende dalle ipotesi di trasporto del paper.
        </p>
      </details>
    </div>
  );
}
