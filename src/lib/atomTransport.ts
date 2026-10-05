/** Figure 8 and Appendix A. Distances are the paper's Table I parameters;
 * the on-screen paths are schematic, not a trajectory or timing simulation.
 */
export type TransportProtocol = "cz" | "czswap";
export type AtomSite = "upper" | "near" | "lower";
export interface TransportAtom {
  site: AtomSite;
  trap: "SLM" | "AOD";
}
export interface TransportStage {
  title: string;
  description: string;
  A: TransportAtom;
  B: TransportAtom;
  interacting: boolean;
  transfers: number;
  bigMoves: number;
  offsetMoves: number;
  czGates: number;
}
const staticAtom = (site: AtomSite): TransportAtom => ({ site, trap: "SLM" });
const mobileAtom = (site: AtomSite): TransportAtom => ({ site, trap: "AOD" });
const initial: TransportStage = {
  title: "Posizioni iniziali",
  description: "A e B si trovano in trappole statiche, in due zone separate.",
  A: staticAtom("lower"),
  B: staticAtom("upper"),
  interacting: false,
  transfers: 0,
  bigMoves: 0,
  offsetMoves: 0,
  czGates: 0,
};
const stage = (previous: TransportStage, patch: Partial<TransportStage>): TransportStage => ({
  ...previous,
  ...patch,
});
const pickA = stage(initial, {
  title: "Preleva A",
  description: "La pinzetta mobile AOD prende A dalla trappola statica SLM.",
  A: mobileAtom("lower"),
  transfers: 1,
});
const moveA = stage(pickA, {
  title: "Avvicina A a B",
  description: "A percorre il primo viaggio lungo e raggiunge la distanza necessaria per il CZ.",
  A: mobileAtom("near"),
  bigMoves: 1,
});
const cz = stage(moveA, {
  title: "Applica CZ",
  description:
    "A interagisce con B mentre è ancora nella trappola mobile: è il protocollo della figura 8(a).",
  interacting: true,
  czGates: 1,
});
const returnA = stage(cz, {
  title: "Riporta A indietro",
  description:
    "La pinzetta mobile riporta A alla sua zona iniziale. B resta nella propria trappola.",
  interacting: false,
  A: mobileAtom("lower"),
  bigMoves: 2,
});
const dropA = stage(returnA, {
  title: "Deposita A",
  description:
    "A torna in una trappola statica. Le due zone contengono gli stessi atomi dell’inizio.",
  A: staticAtom("lower"),
  transfers: 2,
});
const swapMoveA = stage(moveA, {
  description:
    "A si avvicina a B. Nel modello, questo viaggio include due brevi offset per i trasferimenti e l’accesso alle trappole vuote.",
  offsetMoves: 2,
});
const swapDropA = stage(swapMoveA, {
  title: "Deposita A vicino a B",
  description: "A viene lasciato in una trappola statica libera vicino a B.",
  A: staticAtom("near"),
  transfers: 2,
});
const swapCZ = stage(swapDropA, {
  title: "Applica CZ",
  description: "Si esegue un solo CZ tra A e B, prima di completare lo scambio fisico.",
  interacting: true,
  czGates: 1,
});
const pickB = stage(swapCZ, {
  title: "Preleva B",
  description: "La pinzetta mobile prende B. A resta nella nuova trappola statica.",
  interacting: false,
  B: mobileAtom("upper"),
  transfers: 3,
});
const moveB = stage(pickB, {
  title: "Porta B nella zona iniziale di A",
  description:
    "B compie il secondo viaggio lungo. Gli altri due offset completano i quattro previsti dal modello.",
  B: mobileAtom("lower"),
  bigMoves: 2,
  offsetMoves: 4,
});
const dropB = stage(moveB, {
  title: "Deposita B",
  description:
    "B occupa la zona iniziale di A; A resta nella zona di B, in una trappola vicina. Il CZ è stato seguito dallo scambio fisico.",
  B: staticAtom("lower"),
  transfers: 4,
});

export const TRANSPORT_STAGES: Record<TransportProtocol, readonly TransportStage[]> = {
  cz: [initial, pickA, moveA, cz, returnA, dropA],
  czswap: [initial, pickA, swapMoveA, swapDropA, swapCZ, pickB, moveB, dropB],
};
export const TRANSPORT_PARAMETERS = {
  initialDistance: 15,
  interactionDistance: 3,
  offsetDistance: 2,
} as const;

export function transportStage(protocol: TransportProtocol, step: number): TransportStage {
  const stages = TRANSPORT_STAGES[protocol];
  return stages[Math.max(0, Math.min(stages.length - 1, Math.trunc(step)))];
}

/** Sum of both atoms' modeled path lengths, not final separation. */
export function transportDistance(stage: TransportStage): number {
  const p = TRANSPORT_PARAMETERS;
  return (
    stage.bigMoves * (p.initialDistance - p.interactionDistance) +
    stage.offsetMoves * p.offsetDistance
  );
}
