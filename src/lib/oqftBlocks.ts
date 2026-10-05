/** Figure 7(a), bottom drawings, source PDF page 11. These are logical block
 * labels, not quantum amplitudes. Numbers are local to each eight-qubit ladder.
 * Coordinates describe the source drawing's label placement. Only the two
 * transitions marked transport represent physical movement; a QFT remaps labels.
 */
export type OqftBlockId = "A" | "B" | "C" | "D";
export interface OqftBlock {
  id: OqftBlockId;
  column: number;
  row: number;
  /** Four labels in top-left, top-right, bottom-left, bottom-right order. */
  labels: number[];
}
export interface OqftStage {
  title: string;
  description: string;
  operation: "initial" | "qft" | "inverse" | "transport";
  active: OqftBlockId[];
  blocks: OqftBlock[];
}
const block = (id: OqftBlockId, column: number, row: number, labels: number[]): OqftBlock => ({
  id,
  column,
  row,
  labels,
});

// Reviewed against every colored 2×2 patch at t₀…t₅ in the original drawing.
export const OQFT_STAGES: readonly OqftStage[] = [
  {
    title: "t₀ · Disposizione iniziale",
    description:
      "Quattro blocchi da m = 4 qubit, in due colonne. A–B e C–D formano due ladder da 2m qubit.",
    operation: "initial",
    active: [],
    blocks: [
      block("A", 0, 0, [2, 4, 1, 3]),
      block("B", 1, 0, [6, 8, 5, 7]),
      block("C", 0, 1, [2, 4, 1, 3]),
      block("D", 1, 1, [6, 8, 5, 7]),
    ],
  },
  {
    title: "t₁ · Primo strato QFT",
    description:
      "Le QFT sui due ladder invertono le etichette: B precede A e D precede C. Questo cambio di ordine logico non è un trasporto di atomi.",
    operation: "qft",
    active: ["A", "B", "C", "D"],
    blocks: [
      block("A", 1, 0, [3, 1, 4, 2]),
      block("B", 0, 0, [7, 5, 8, 6]),
      block("C", 1, 1, [3, 1, 4, 2]),
      block("D", 0, 1, [7, 5, 8, 6]),
    ],
  },
  {
    title: "t₂ · QFT inverse locali",
    description:
      "Le QFT† da m qubit ripristinano l’ordine interno di A, B e D. C non riceve questo strato, come nella figura e nella nota 5 del paper.",
    operation: "inverse",
    active: ["A", "B", "D"],
    blocks: [
      block("A", 1, 0, [2, 4, 1, 3]),
      block("B", 0, 0, [6, 8, 5, 7]),
      block("C", 1, 1, [3, 1, 4, 2]),
      block("D", 0, 1, [6, 8, 5, 7]),
    ],
  },
  {
    title: "t₃ · Trasporto della prima colonna",
    description:
      "La colonna con B e D sale di una posizione. Le etichette interne restano uguali; D diventa adiacente ad A per la QFT successiva.",
    operation: "transport",
    active: ["B", "D"],
    blocks: [
      block("A", 1, 0, [2, 4, 1, 3]),
      block("B", 0, -1, [6, 8, 5, 7]),
      block("C", 1, 1, [3, 1, 4, 2]),
      block("D", 0, 0, [6, 8, 5, 7]),
    ],
  },
  {
    title: "t₄ · Strato QFT finale",
    description:
      "Lo strato finale cambia nuovamente l’ordine delle etichette di A, B e D. C resta escluso dalla QFT finale da 2m; gli spazi vuoti corrispondono a quelli del disegno originale.",
    operation: "qft",
    active: ["A", "B", "D"],
    blocks: [
      block("A", 0, 0, [3, 1, 4, 2]),
      block("B", 1, -1, [7, 5, 8, 6]),
      block("C", 0, 1, [3, 1, 4, 2]),
      block("D", 1, 0, [7, 5, 8, 6]),
    ],
  },
  {
    title: "t₅ · Riordino finale",
    description:
      "La colonna con A e C viene traslata in alto e oltre l’altra colonna. L’ordine dei blocchi è ripristinato a meno dell’inversione sinistra–destra indicata nel paper.",
    operation: "transport",
    active: ["A", "C"],
    blocks: [
      block("A", 2, -1, [3, 1, 4, 2]),
      block("B", 1, -1, [7, 5, 8, 6]),
      block("C", 2, 0, [3, 1, 4, 2]),
      block("D", 1, 0, [7, 5, 8, 6]),
    ],
  },
];

export function oqftStage(step: number): OqftStage {
  return OQFT_STAGES[Math.max(0, Math.min(OQFT_STAGES.length - 1, Math.trunc(step)))];
}
