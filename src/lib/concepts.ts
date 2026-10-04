import type { Concept } from "../types";

export type TextSegment = string | { text: string; conceptId: string };

export interface ConceptMatcher {
  byId: Map<string, Concept>;
  /** null when there's nothing to match (no concepts.json for this paper). */
  pattern: RegExp | null;
  conceptFor: Map<string, string>; // lowercased spelling → concept id
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildConceptMatcher(concepts: Concept[]): ConceptMatcher {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const conceptFor = new Map<string, string>();
  for (const c of concepts) {
    for (const spelling of [c.term, ...c.aliases]) {
      const key = spelling.trim().toLowerCase().replace(/\s+/g, " ");
      if (!conceptFor.has(key)) conceptFor.set(key, c.id);
    }
  }
  return { byId, pattern: spellingPattern([...conceptFor.keys()]), conceptFor };
}

/**
 * Case-insensitive, whole-word regex matching any of `spellings` (null if there are none).
 * Longest first, so "Z-phase gadget" wins over "phase gadget" at the same position. The
 * lookarounds stand in for \b, which doesn't understand non-ASCII letters or symbols like ∧X.
 * A space matches any whitespace run, so a term wrapped across a PDF line still matches.
 */
export function spellingPattern(spellings: string[]): RegExp | null {
  const alternatives = [...new Set(spellings.map((s) => s.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((s) => escapeRegExp(s).replace(/\s+/g, "\\s+"));
  if (alternatives.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

/** How the concept is spelled in the PDF: its explicit pdfTerms, else the spellings used in explanations. */
export function pdfSpellings(concept: Concept): string[] {
  return concept.pdfTerms?.length ? concept.pdfTerms : [concept.term, ...concept.aliases];
}

/** Splits `text` into plain runs and concept mentions — only the first mention of each concept, to keep notes readable. */
export function segmentText(text: string, matcher: ConceptMatcher): TextSegment[] {
  if (!matcher.pattern) return [text];
  const segments: TextSegment[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const match of text.matchAll(matcher.pattern)) {
    const conceptId = matcher.conceptFor.get(match[0].toLowerCase().replace(/\s+/g, " "));
    if (!conceptId || seen.has(conceptId)) continue;
    seen.add(conceptId);
    const start = match.index ?? 0;
    if (start > last) segments.push(text.slice(last, start));
    segments.push({ text: match[0], conceptId });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

/** The definition for the selected variant, falling back to the concept's first one. */
export function conceptDefinition(
  concept: Concept,
  variant: string,
): { text: string; isFallback: boolean } {
  const text = concept.definitions[variant];
  if (text) return { text, isFallback: false };
  const first = Object.values(concept.definitions)[0] ?? "";
  return { text: first, isFallback: true };
}
