import { useId, useState } from "react";
import {
  CANVAS_PRESETS,
  OBSERVATIONS,
  ROOM,
  SCENE_OBJECTS,
  firstAppearance,
  placeContinuous,
  rasterize,
  readableFirstAppearance,
  seamDirection,
  seamSplitObjects,
  type CanvasPose,
  type PlacedToken,
} from "../../lib/canvasProjection";

const GRIDS = [
  { cell: 0, label: "Posizioni continue" },
  { cell: 10, label: "Griglia 10°" },
  { cell: 30, label: "Griglia 30°" },
] as const;

// Floor plan: 40 px per metre, forward (+z) pointing up.
const planX = (x: number) => 140 + x * 40;
const planY = (z: number) => 30 + (2.5 - z) * 40;
// Panorama: one unit per degree, θ = −180° on the left edge, φ = +90° on top.
const panoX = (theta: number) => 20 + theta + 180;
const panoY = (phi: number) => 14 + 90 - phi;

const objectName = (id: string) => SCENE_OBJECTS.find((o) => o.id === id)?.name ?? id;
const fmt = (n: number, digits = 1) => n.toFixed(digits).replace(".", ",");
const frameLabel = (t: number) => (Number.isInteger(t) ? String(t) : fmt(t));

export default function CanvasProjectionFigure() {
  const [preset, setPreset] = useState("centre");
  const [yaw, setYaw] = useState(0);
  const [cell, setCell] = useState<number>(0);
  const [selected, setSelected] = useState("table");
  const planTitle = useId();
  const panoTitle = useId();
  const yawId = useId();
  const base = CANVAS_PRESETS.find((p) => p.id === preset)!.pose;
  const pose: CanvasPose = { ...base, yaw };
  const continuous = placeContinuous(pose);
  const tokens = cell ? rasterize(continuous, cell) : continuous;
  const trueFirst = firstAppearance();
  const readable = readableFirstAppearance(tokens);
  const lostFirst = SCENE_OBJECTS.filter((o) => readable.get(o.id) !== trueFirst.get(o.id));
  const split = seamSplitObjects(continuous);
  const [seamDx, seamDz] = seamDirection(pose);
  const forward = [Math.sin((yaw * Math.PI) / 180), Math.cos((yaw * Math.PI) / 180)];
  const selectedTokens = tokens.filter((t) => t.objects.includes(selected));

  // Tokens that share a position stay separate; only their drawing is offset.
  const seen = new Map<string, number>();
  const drawn = tokens.map((token) => {
    const key = `${Math.round(token.theta * 2)}:${Math.round(token.phi * 2)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    return { token, offset: index * 9 };
  });

  return (
    <div className="canvas-projection">
      <p className="figure-description">
        Schema esplicativo, non una ricostruzione della figura: una stanza inventata, osservata in
        sei fotogrammi, con le formule del paper (§3.2, App. B.2 e B.5). Ogni punto è una patch
        sollevata in 3D; il numero è il fotogramma da cui proviene.
      </p>
      <div className="twine-panels" role="group" aria-label="Origine della tela">
        {CANVAS_PRESETS.map((p) => (
          <button
            key={p.id}
            aria-pressed={preset === p.id}
            onClick={() => {
              setPreset(p.id);
              setYaw(p.pose.yaw);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="twine-timeline" htmlFor={yawId}>
        Rotazione della tela: {yaw}°
        <input
          id={yawId}
          type="range"
          min="-180"
          max="180"
          step="5"
          value={yaw}
          onChange={(e) => setYaw(Number(e.target.value))}
        />
      </label>
      <div className="canvas-projection-views">
        <div className="canvas-projection-view">
          <h4>Pianta della stanza</h4>
          <svg viewBox="0 0 280 340" role="img" aria-labelledby={planTitle}>
            <title id={planTitle}>
              Pianta vista dall’alto. Origine della tela in x {fmt(pose.x)} m, z {fmt(pose.z)} m,
              rotazione {yaw}°.
            </title>
            <rect
              x={planX(ROOM.minX)}
              y={planY(ROOM.maxZ)}
              width={(ROOM.maxX - ROOM.minX) * 40}
              height={(ROOM.maxZ - ROOM.minZ) * 40}
              className="canvas-room"
            />
            <line
              x1={planX(pose.x)}
              y1={planY(pose.z)}
              x2={planX(pose.x + seamDx * 3)}
              y2={planY(pose.z + seamDz * 3)}
              className="canvas-seam-ray"
            />
            {selectedTokens.length > 0 &&
              OBSERVATIONS.filter((o) => o.object === selected).map((o, i) => (
                <line
                  key={i}
                  x1={planX(pose.x)}
                  y1={planY(pose.z)}
                  x2={planX(o.p[0])}
                  y2={planY(o.p[2])}
                  className="canvas-ray"
                />
              ))}
            {OBSERVATIONS.map((o, i) => (
              <circle
                key={i}
                cx={planX(o.p[0])}
                cy={planY(o.p[2])}
                r="5"
                className={`canvas-dot canvas-obj-${o.object}${o.object === selected ? " is-selected" : ""}`}
              />
            ))}
            <g className="canvas-origin" transform={`translate(${planX(pose.x)} ${planY(pose.z)})`}>
              <circle r="7" />
              <line x1="0" y1="0" x2={forward[0] * 26} y2={-forward[1] * 26} />
            </g>
            <text x={planX(pose.x) + 10} y={planY(pose.z) + 18} className="canvas-small">
              origine c
            </text>
          </svg>
        </div>
        <div className="canvas-projection-view">
          <h4>Tela equirettangolare</h4>
          <svg viewBox="0 0 400 210" role="img" aria-labelledby={panoTitle}>
            <title id={panoTitle}>
              Tela panoramica con {tokens.length} token. Longitudine da −180° a sinistra a +180° a
              destra, latitudine positiva in alto.
            </title>
            <rect x={panoX(-180)} y={panoY(90)} width="360" height="180" className="canvas-pano" />
            {cell > 0 &&
              Array.from({ length: 360 / cell - 1 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={panoX(-180 + (i + 1) * cell)}
                  x2={panoX(-180 + (i + 1) * cell)}
                  y1={panoY(90)}
                  y2={panoY(-90)}
                  className="canvas-cell"
                />
              ))}
            {cell > 0 &&
              Array.from({ length: 180 / cell - 1 }, (_, i) => (
                <line
                  key={`h${i}`}
                  y1={panoY(-90 + (i + 1) * cell)}
                  y2={panoY(-90 + (i + 1) * cell)}
                  x1={panoX(-180)}
                  x2={panoX(180)}
                  className="canvas-cell"
                />
              ))}
            <line
              x1={panoX(0)}
              x2={panoX(0)}
              y1={panoY(90)}
              y2={panoY(-90)}
              className="canvas-axis"
            />
            <line
              x1={panoX(-180)}
              x2={panoX(180)}
              y1={panoY(0)}
              y2={panoY(0)}
              className="canvas-axis"
            />
            <line
              x1={panoX(-180)}
              x2={panoX(-180)}
              y1={panoY(90)}
              y2={panoY(-90)}
              className="canvas-seam"
            />
            <line
              x1={panoX(180)}
              x2={panoX(180)}
              y1={panoY(90)}
              y2={panoY(-90)}
              className="canvas-seam"
            />
            {[
              [-180, "W 0 · −180°"],
              [0, "W 50 · avanti"],
              [180, "W 100 · +180°"],
            ].map(([theta, text]) => (
              <text
                key={theta}
                x={panoX(Number(theta))}
                y="207"
                textAnchor={theta === -180 ? "start" : theta === 180 ? "end" : "middle"}
                className="canvas-small"
              >
                {text}
              </text>
            ))}
            {drawn.map(({ token, offset }, i) => (
              <g
                key={i}
                className={`canvas-token${token.objects.length > 1 ? " is-mixed" : ` canvas-obj-${token.objects[0]}`}${token.objects.includes(selected) ? " is-selected" : ""}`}
                style={{
                  transform: `translate(${panoX(token.theta) + offset}px, ${panoY(token.phi)}px)`,
                }}
              >
                <title>{describe(token)}</title>
                <circle r="8" />
                <text dy="3.5" textAnchor="middle">
                  {frameLabel(token.t)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="twine-panels" role="group" aria-label="Disposizione dei token">
        {GRIDS.map((g) => (
          <button key={g.cell} aria-pressed={cell === g.cell} onClick={() => setCell(g.cell)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="twine-panels canvas-objects" role="group" aria-label="Oggetto evidenziato">
        {SCENE_OBJECTS.map((o) => (
          <button
            key={o.id}
            aria-pressed={selected === o.id}
            className={`canvas-obj-${o.id}`}
            onClick={() => setSelected(o.id)}
          >
            <span className="canvas-swatch" aria-hidden="true" />
            {o.name}
          </button>
        ))}
      </div>
      <dl className="transport-counts canvas-counts">
        <div>
          <dt>Token sulla tela</dt>
          <dd>
            {tokens.length} da {OBSERVATIONS.length} patch
          </dd>
        </div>
        <div>
          <dt>Prima apparizione alterata</dt>
          <dd className="canvas-lost">
            {lostFirst.length === 0
              ? "nessuna"
              : lostFirst
                  .map(
                    (o) =>
                      `${o.name} (${trueFirst.get(o.id)} → ${frameLabel(readable.get(o.id)!)})`,
                  )
                  .join(", ")}
          </dd>
        </div>
      </dl>
      <p className="canvas-seam-state" role="status">
        {split.size > 0
          ? `Giunzione: ${[...split].map(objectName).join(" e ")} ${split.size > 1 ? "hanno" : "ha"} patch ai due capi della tela (W vicino a 0 e a 100), pur essendo vicine nella stanza. Ruota la tela per spostarla.`
          : "Giunzione: nessun oggetto è tagliato dal bordo a ±180°."}
      </p>
      <div className="canvas-selected">
        <strong>{objectName(selected)}</strong>
        <ul>
          {selectedTokens.map((token, i) => (
            <li key={i}>{describe(token)}</li>
          ))}
        </ul>
      </div>
      <details className="figure-model-details">
        <summary>Come è calcolato</summary>
        <p>
          q = Rᵀ(p − c); θ = atan2(q<sub>x</sub>, q<sub>z</sub>), φ = arctan(−q<sub>y</sub> / √(q
          <sub>x</sub>² + q<sub>z</sub>²)); W e H sono θ e φ riscalati linearmente in [0, 100], T è
          il fotogramma. Due patch nella stessa direzione restano due token distinti e si
          distinguono solo per ‖q‖, che il modello riceve dall’embedding 3D: nel disegno sono
          affiancate solo per leggibilità. La griglia riproduce il controllo dell’Appendice B.2:
          media di fotogramma e distanza per cella, token al centro della cella. Le coordinate della
          stanza sono inventate.
        </p>
      </details>
    </div>
  );
}

function describe(token: PlacedToken) {
  const what = token.objects.map(objectName).join(" + ");
  const frame = Number.isInteger(token.t)
    ? `fotogramma ${token.t}`
    : `fotogramma medio ${fmt(token.t)}`;
  const merged = token.patches > 1 ? ` · ${token.patches} patch fuse` : "";
  return `${what} · θ ${fmt(token.theta)}°, φ ${fmt(token.phi)}° → W ${fmt(token.w)}, H ${fmt(token.h)} · ${frame} · ‖q‖ ${fmt(token.radius, 2)} m${merged}`;
}
