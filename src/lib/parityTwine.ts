import { TWINE_GATES, type TwinePanel, type TwineRole } from "./parityTwinePrograms.ts";
export type { TwinePanel, TwineRole } from "./parityTwinePrograms.ts";

export interface TwineGate {
  step: number;
  sourceX: number;
  control: number;
  target: number;
  role: TwineRole;
}
export interface TwineEdge {
  from: number;
  to: number;
  role: "backbone" | "leg";
  dashed?: boolean;
}
export interface TwineCircuit {
  panel: TwinePanel;
  qubits: number;
  gates: TwineGate[];
  /** Positions in a 440 by 170 SVG. Indices match the physical wire numbers. */
  nodes: [number, number][];
  edges: TwineEdge[];
  expectedOutput: number[];
}

export function twineCircuit(panel: TwinePanel): TwineCircuit {
  const edge = (from: number, to: number, role: TwineEdge["role"] = "backbone"): TwineEdge => ({
    from,
    to,
    role,
  });
  const nodes: [number, number][] =
    panel === "a"
      ? Array.from({ length: 6 }, (_, i) => [40 + i * 72, 85])
      : panel === "b"
        ? [
            [90, 40],
            [220, 40],
            [350, 40],
            [350, 130],
            [220, 130],
            [90, 130],
          ]
        : [
            [90, 40],
            [90, 130],
            [220, 40],
            [220, 130],
            [350, 40],
            [350, 130],
          ];
  const edges =
    panel === "a"
      ? [edge(0, 1), edge(1, 2), edge(2, 3), edge(3, 4), edge(4, 5)]
      : panel === "b"
        ? [
            edge(1, 4),
            edge(0, 1, "leg"),
            edge(1, 2, "leg"),
            edge(3, 4, "leg"),
            edge(4, 5, "leg"),
            { ...edge(2, 3, "leg"), dashed: true },
          ]
        : [
            edge(0, 2),
            edge(2, 4),
            edge(1, 3),
            edge(3, 5),
            edge(0, 1, "leg"),
            edge(2, 3, "leg"),
            edge(4, 5, "leg"),
          ];
  return {
    panel,
    qubits: 6,
    nodes,
    edges,
    expectedOutput: panel === "b" ? [1, 8, 4, 32, 16, 2] : [32, 16, 8, 4, 2, 1],
    gates: TWINE_GATES[panel].map(([sourceX, control, target, role], i) => ({
      sourceX,
      control,
      target,
      role,
      step: i + 1,
    })),
  };
}

function isPair(mask: number): boolean {
  // Clear one bit; a pair has exactly one bit left.
  const remaining = mask & (mask - 1);
  return remaining !== 0 && (remaining & (remaining - 1)) === 0;
}

/** Each bit denotes one logical Z label. CNOT XORs control into target.
 * Snapshots traverse individual gates in drawing order, not a physical timing model.
 */
export function twineSnapshot(circuit: TwineCircuit, step: number) {
  const labels = Array.from({ length: circuit.qubits }, (_, i) => 1 << i);
  const pairs = new Set<number>();
  const newPairs = new Set<number>();
  const active = circuit.gates[step - 1];
  for (const gate of circuit.gates) {
    if (gate.step > step) break;
    labels[gate.target] ^= labels[gate.control];
    const label = labels[gate.target];
    if (isPair(label) && !pairs.has(label)) {
      pairs.add(label);
      if (gate.step === step) newPairs.add(label);
    }
  }
  return { labels, pairs, newPairs, active };
}

export function twinePairs(qubits: number): number[] {
  const pairs: number[] = [];
  for (let i = 0; i < qubits; i++)
    for (let j = i + 1; j < qubits; j++) pairs.push((1 << i) | (1 << j));
  return pairs;
}

export function parityLabel(mask: number): string {
  return (
    ["₁", "₂", "₃", "₄", "₅", "₆"]
      .flatMap((index, i) => (mask & (1 << i) ? [`ℓ${index}`] : []))
      .join("") || "∅"
  );
}
