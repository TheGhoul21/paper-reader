import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFigurePlayback } from "../../lib/useFigurePlayback";
import FigurePlayback from "./FigurePlayback";
import {
  parityLabel,
  twineCircuit,
  twinePairs,
  twineSnapshot,
  type TwineCircuit,
  type TwinePanel,
} from "../../lib/parityTwine";
import { TWINE_BANDS } from "../../lib/parityTwinePrograms";

const PANELS = [
  { id: "a", title: "(a) Lineare" },
  { id: "b", title: "(b) Quadrato" },
  { id: "c", title: "(c) Scala" },
] as const;
const DESCRIPTIONS = {
  a: "Sei qubit in una fila. Il backbone usa DCNOT; le CNOT rosse recuperano le etichette singole in ordine inverso.",
  b: "Sei qubit su una griglia. Il backbone collega i qubit 2 e 5; i rami raggiungono i qubit laterali. La decodifica finale lascia l’ordine indicato nella figura.",
  c: "Sei qubit su una scala. Due backbone paralleli avanzano lungo le file; le CNOT dei rami collegano le due file. La decodifica ripristina le etichette singole in ordine inverso.",
};
const ROLE_NAMES = { backbone: "Backbone", leg: "Ramo", decoder: "Decodifica" };

function TwinePath({ circuit, step }: { circuit: TwineCircuit; step: number }) {
  const titleId = useId();
  const active = circuit.gates[step - 1];
  return (
    <div className="twine-path">
      <span>Twine path · collegamenti tra i qubit fisici</span>
      <svg viewBox="0 0 440 170" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          Layout {PANELS.find((p) => p.id === circuit.panel)?.title}, sei qubit.{" "}
          {active
            ? `Porta attiva da qubit ${active.control + 1} a qubit ${active.target + 1}.`
            : "Nessuna porta applicata."}
        </title>
        {circuit.edges.map((edge) => {
          const [x1, y1] = circuit.nodes[edge.from];
          const [x2, y2] = circuit.nodes[edge.to];
          const selected =
            active &&
            [edge.from, edge.to].includes(active.control) &&
            [edge.from, edge.to].includes(active.target);
          return (
            <g
              key={`${edge.from}-${edge.to}`}
              className={`twine-path-edge twine-role-${edge.role}${edge.dashed ? " is-dashed" : ""}${selected ? " is-active" : ""}`}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              {edge.role === "backbone" && (
                <line
                  x1={x1 + (x1 === x2 ? 4 : 0)}
                  y1={y1 + (y1 === y2 ? 4 : 0)}
                  x2={x2 + (x1 === x2 ? 4 : 0)}
                  y2={y2 + (y1 === y2 ? 4 : 0)}
                />
              )}
            </g>
          );
        })}
        {circuit.nodes.map(([x, y], i) => (
          <g
            key={i}
            className={`twine-path-node${active?.target === i ? " is-target" : active?.control === i ? " is-control" : ""}`}
          >
            <circle cx={x} cy={y} r="17" />
            <text x={x} y={y + 5} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CircuitDrawing({ circuit, step }: { circuit: TwineCircuit; step: number }) {
  const titleId = useId();
  const region = useRef<HTMLDivElement>(null);
  const snapshot = twineSnapshot(circuit, step);
  const firstX = circuit.gates[0].sourceX;
  const lastX = circuit.gates.at(-1)!.sourceX;
  const x = (sourceX: number) => 72 + ((sourceX - firstX) / (lastX - firstX)) * 700;
  const y = (qubit: number) => 48 + (5 - qubit) * 42;
  const cursorX = snapshot.active ? x(snapshot.active.sourceX) : 52;
  const width = 900;
  useEffect(() => {
    const pane = region.current;
    if (pane)
      pane.scrollTo({
        left: (cursorX / width) * pane.scrollWidth - pane.clientWidth / 2,
        behavior: "instant",
      });
  }, [cursorX]);
  return (
    <div
      className="twine-circuit-scroll"
      ref={region}
      role="region"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the source circuit on small screens.
      tabIndex={0}
      aria-label="Circuito, scorribile orizzontalmente"
    >
      <svg viewBox={`0 0 ${width} 300`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          Circuito {PANELS.find((p) => p.id === circuit.panel)?.title}, passaggio {step}.{" "}
          {snapshot.labels.map((label, i) => ` Qubit ${i + 1}: ${parityLabel(label)}.`).join("")}
        </title>
        <text x="52" y="18" className="twine-axis">
          Ordine di lettura →
        </text>
        {TWINE_BANDS[circuit.panel].map((points, i) => (
          <polygon
            key={i}
            className="twine-band"
            points={points.map(([px, py]) => `${x(px)},${y(py)}`).join(" ")}
          />
        ))}
        {snapshot.labels.map((label, i) => (
          <g key={i}>
            <text x="10" y={y(i) + 5} className="twine-qubit">
              q{i + 1}
            </text>
            <line x1="45" y1={y(i)} x2="795" y2={y(i)} className="twine-wire" />
            <text
              key={`${i}-${label}`}
              x="806"
              y={y(i) + 5}
              className={`twine-label${snapshot.active?.target === i ? " is-changed" : ""}`}
            >
              {parityLabel(label)}
            </text>
          </g>
        ))}
        <g className="twine-playhead" style={{ transform: `translateX(${cursorX}px)` }}>
          <line y1="28" y2="278" />
        </g>
        {circuit.gates.map((gate) => (
          <g
            key={gate.step}
            className={`twine-gate twine-role-${gate.role}${gate.step === step ? " is-active" : gate.step < step ? " is-past" : ""}`}
          >
            <line
              x1={x(gate.sourceX)}
              y1={y(gate.control)}
              x2={x(gate.sourceX)}
              y2={y(gate.target)}
            />
            <circle cx={x(gate.sourceX)} cy={y(gate.control)} r="3.5" className="twine-control" />
            <circle cx={x(gate.sourceX)} cy={y(gate.target)} r="7.5" className="twine-target" />
            <line
              x1={x(gate.sourceX) - 7.5}
              y1={y(gate.target)}
              x2={x(gate.sourceX) + 7.5}
              y2={y(gate.target)}
            />
            <line
              x1={x(gate.sourceX)}
              y1={y(gate.target) - 7.5}
              x2={x(gate.sourceX)}
              y2={y(gate.target) + 7.5}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ParityTwineFigure({ initialPanel = "a" }: { initialPanel?: TwinePanel }) {
  const [panel, setPanel] = useState(initialPanel);

  const circuit = useMemo(() => twineCircuit(panel), [panel]);
  const total = circuit.gates.length;
  const playback = useFigurePlayback(total);
  const { step, playing, goTo } = playback;
  const snapshot = twineSnapshot(circuit, step);
  const pairOptions = twinePairs(6);
  const active = snapshot.active;
  const before = active ? twineSnapshot(circuit, step - 1).labels : [];
  return (
    <div className={`twine-animation${playing ? " is-playing" : ""}`}>
      <div className="twine-panels" role="group" aria-label="Layout della figura 2">
        {PANELS.map((item) => (
          <button
            key={item.id}
            aria-pressed={panel === item.id}
            onClick={() => {
              setPanel(item.id);
              goTo(0);
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <p className="twine-description">{DESCRIPTIONS[panel]}</p>
      <TwinePath circuit={circuit} step={step} />
      <CircuitDrawing circuit={circuit} step={step} />
      <ul className="twine-legend" aria-label="Legenda delle porte">
        <li>
          <span className="twine-role-backbone">●</span> Backbone · DCNOT nere
        </li>
        <li>
          <span className="twine-role-leg">●</span> Rami · CNOT grigie
        </li>
        <li>
          <span className="twine-role-decoder">●</span> Decodifica · CNOT rosse
        </li>
      </ul>
      <p className="twine-notation">
        ● controllo · ⊕ bersaglio. Ogni DCNOT è mostrata come due CNOT. La riproduzione segue le
        porte del disegno e non misura la profondità del circuito.
      </p>
      <FigurePlayback playback={playback} total={total} label="Passaggio del circuito" />
      <div className="twine-state" role="status" aria-live={playing ? "off" : "polite"}>
        {active ? (
          <p>
            {ROLE_NAMES[active.role]} · CNOT {active.control + 1} → {active.target + 1}:{" "}
            {parityLabel(before[active.target])} ⊕ {parityLabel(before[active.control])} ={" "}
            {parityLabel(snapshot.labels[active.target])}.
          </p>
        ) : (
          <p>Etichette iniziali: ogni qubit fisico porta una sola etichetta logica.</p>
        )}
        <dl className="twine-labels">
          {snapshot.labels.map((label, i) => (
            <div key={i} className={active?.target === i ? "is-changed" : undefined}>
              <dt>Qubit {i + 1}</dt>
              <dd>{parityLabel(label)}</dd>
            </div>
          ))}
        </dl>
        <p className="twine-pair-count">Coppie comparse: {snapshot.pairs.size} / 15</p>
        <ul className="twine-pairs" aria-label="Coppie comparse fino a questo passaggio">
          {pairOptions.map((pair) => (
            <li key={pair} className={snapshot.pairs.has(pair) ? "is-seen" : undefined}>
              {parityLabel(pair)} {snapshot.pairs.has(pair) ? "✓" : "·"}
            </li>
          ))}
        </ul>
        {step === total && (
          <p>
            Sono comparse tutte le 15 coppie. La decodifica ha ripristinato le etichette singole
            {panel === "b"
              ? ": ℓ₁, ℓ₄, ℓ₃, ℓ₆, ℓ₅, ℓ₂."
              : " in ordine inverso: ℓ₆, ℓ₅, ℓ₄, ℓ₃, ℓ₂, ℓ₁."}
          </p>
        )}
      </div>
    </div>
  );
}
