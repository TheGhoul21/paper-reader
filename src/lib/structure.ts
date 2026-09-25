import type { ArgumentClaim, Paragraph, PaperStructure } from "../types";

export interface ParagraphRole {
  claimId: string;
  /** "C1", "C2"… in the order claims are listed. */
  label: string;
  kind: "stated" | "evidence";
}

export interface StructureIndex {
  claims: ArgumentClaim[];
  labels: Map<string, string>; // claim id → "C1"…
  /** Paragraph id → the claims it states or supports. */
  roles: Map<string, ParagraphRole[]>;
  /** Every paragraph that states or supports a claim — "il filo", the thread of the argument. */
  thread: Set<string>;
  /** Claim id → its paragraphs (stated first, then evidence), in reading order. */
  paragraphsOf: Map<string, string[]>;
}

export function indexStructure(structure: PaperStructure | null, paragraphs: Paragraph[]): StructureIndex | null {
  if (!structure || structure.claims.length === 0) return null;
  const order = new Map([...paragraphs].sort((a, b) => a.page - b.page || a.order - b.order).map((p, i) => [p.id, i]));
  const byReading = (ids: string[]) => ids.filter((id) => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);
  const labels = new Map(structure.claims.map((c, i) => [c.id, `C${i + 1}`]));
  const roles = new Map<string, ParagraphRole[]>();
  const thread = new Set<string>();
  const paragraphsOf = new Map<string, string[]>();
  for (const claim of structure.claims) {
    const label = labels.get(claim.id)!;
    for (const [ids, kind] of [[claim.statedIn, "stated"], [claim.evidence, "evidence"]] as const) {
      for (const id of ids) {
        if (!order.has(id)) continue;
        thread.add(id);
        const list = roles.get(id) ?? [];
        if (!list.some((r) => r.claimId === claim.id)) list.push({ claimId: claim.id, label, kind });
        roles.set(id, list);
      }
    }
    paragraphsOf.set(claim.id, [...byReading(claim.statedIn), ...byReading(claim.evidence.filter((id) => !claim.statedIn.includes(id)))]);
  }
  return { claims: structure.claims, labels, roles, thread, paragraphsOf };
}

/** Variant text with the same fallback as explanations: the requested variant, else the first available. */
export function pickVariant(texts: Record<string, string>, variant: string): string {
  return texts[variant] ?? Object.values(texts)[0] ?? "";
}
