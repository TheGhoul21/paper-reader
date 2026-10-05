import type { Variant } from "../types";

export interface CatalogConcept {
  id: string;
  term: string;
  aliases: string[];
}

export interface CatalogPaper {
  slug: string;
  title: string;
  authors: string[];
  importedAt: string;
  pageCount: number;
  variants: Variant[];
  problem: string;
  summary: string;
  identifiers: string[];
  concepts: string[];
  guideSteps: number;
  explainedPages: number;
}

export interface Catalog {
  version: 1;
  concepts: CatalogConcept[];
  papers: CatalogPaper[];
}

export const LEVEL_LABELS: Record<Variant["level"], string> = {
  beginner: "Base",
  intermediate: "Intermedio",
  expert: "Esperto",
};
export const LEVEL_ORDER: Variant["level"][] = ["beginner", "intermediate", "expert"];
export type CatalogSort = "relevance" | "recent" | "title" | "pages";
export interface CatalogFilters {
  query: string;
  language: string;
  level: string;
  concept: string;
  guide: string;
  sort: CatalogSort;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Reject a damaged manifest before using its strings, dimensions or cross-references. */
export function parseCatalog(value: unknown): Catalog {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.concepts) ||
    !Array.isArray(value.papers)
  )
    throw new Error("Indice del catalogo non valido");
  const conceptIds = new Set<string>();
  for (const concept of value.concepts) {
    if (
      !record(concept) ||
      typeof concept.id !== "string" ||
      !concept.id ||
      conceptIds.has(concept.id) ||
      typeof concept.term !== "string" ||
      !strings(concept.aliases)
    )
      throw new Error("Concetto del catalogo non valido");
    conceptIds.add(concept.id);
  }
  const slugs = new Set<string>();
  for (const paper of value.papers) {
    if (
      !record(paper) ||
      typeof paper.slug !== "string" ||
      !/^[a-z0-9-]+$/.test(paper.slug) ||
      slugs.has(paper.slug) ||
      typeof paper.title !== "string" ||
      !strings(paper.authors) ||
      typeof paper.importedAt !== "string" ||
      !Number.isFinite(Date.parse(paper.importedAt)) ||
      !count(paper.pageCount) ||
      paper.pageCount === 0 ||
      typeof paper.problem !== "string" ||
      typeof paper.summary !== "string" ||
      !strings(paper.identifiers) ||
      !strings(paper.concepts) ||
      paper.concepts.some((id) => !conceptIds.has(id)) ||
      !count(paper.guideSteps) ||
      !count(paper.explainedPages) ||
      paper.explainedPages > paper.pageCount ||
      !Array.isArray(paper.variants) ||
      !paper.variants.length ||
      paper.variants.some(
        (variant) =>
          !record(variant) ||
          typeof variant.key !== "string" ||
          typeof variant.language !== "string" ||
          typeof variant.label !== "string" ||
          !LEVEL_ORDER.includes(variant.level as Variant["level"]),
      )
    )
      throw new Error("Paper del catalogo non valido");
    slugs.add(paper.slug);
  }
  return value as unknown as Catalog;
}

export function normalizeCatalogText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface SearchEntry {
  paper: CatalogPaper;
  fields: { text: string; weight: number }[];
}

/** Normalize once per manifest, rather than rebuilding thousands of strings per keystroke. */
export function createCatalogSearch(catalog: Catalog) {
  const concepts = new Map(catalog.concepts.map((concept) => [concept.id, concept]));
  const entries: SearchEntry[] = catalog.papers.map((paper) => ({
    paper,
    fields: [
      { text: normalizeCatalogText(paper.identifiers.join(" ")), weight: 10 },
      { text: normalizeCatalogText(paper.title), weight: 8 },
      { text: normalizeCatalogText(paper.authors.join(" ")), weight: 6 },
      {
        text: normalizeCatalogText(
          paper.concepts
            .flatMap((id) => {
              const concept = concepts.get(id);
              return concept ? [concept.term, ...concept.aliases] : [];
            })
            .join(" "),
        ),
        weight: 5,
      },
      { text: normalizeCatalogText(paper.summary), weight: 1 },
    ],
  }));
  return (filters: CatalogFilters): CatalogPaper[] => {
    const query = normalizeCatalogText(
      filters.query
        .trim()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, "")
        .replace(/^arxiv:\s*/i, "")
        .replace(/\.pdf$/i, ""),
    );
    const tokens = [...new Set(query.split(" ").filter(Boolean))];
    const matches: { paper: CatalogPaper; score: number }[] = [];
    for (const { paper, fields } of entries) {
      // Language and level must be available in the same explanation variant.
      if (
        !paper.variants.some(
          (variant) =>
            (filters.language === "all" || variant.language === filters.language) &&
            (filters.level === "all" || variant.level === filters.level),
        )
      )
        continue;
      if (filters.concept !== "all" && !paper.concepts.includes(filters.concept)) continue;
      if (filters.guide === "guided" && !paper.guideSteps) continue;
      if (filters.guide === "pdf" && paper.guideSteps) continue;
      let score = 0;
      let found = true;
      for (const token of tokens) {
        const best = Math.max(
          0,
          ...fields.map((field) => (field.text.includes(token) ? field.weight : 0)),
        );
        if (!best) {
          found = false;
          break;
        }
        score += best;
      }
      if (!found) continue;
      if (query)
        score += fields.reduce(
          (total, field) => total + (field.text.includes(query) ? field.weight * 2 : 0),
          0,
        );
      matches.push({ paper, score });
    }
    matches.sort((a, b) => {
      if (filters.sort === "relevance" && tokens.length && a.score !== b.score)
        return b.score - a.score;
      if (filters.sort === "title")
        return a.paper.title.localeCompare(b.paper.title, "it", { sensitivity: "base" });
      if (filters.sort === "pages" && a.paper.pageCount !== b.paper.pageCount)
        return a.paper.pageCount - b.paper.pageCount;
      return (
        b.paper.importedAt.localeCompare(a.paper.importedAt) ||
        a.paper.title.localeCompare(b.paper.title)
      );
    });
    return matches.map(({ paper }) => paper);
  };
}

export function catalogFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? "",
    language: params.get("language") ?? "all",
    level: LEVEL_ORDER.includes(params.get("level") as Variant["level"])
      ? params.get("level")!
      : "all",
    concept: params.get("concept") ?? "all",
    guide: ["guided", "pdf"].includes(params.get("guide") ?? "") ? params.get("guide")! : "all",
    sort: ["relevance", "recent", "title", "pages"].includes(sort ?? "")
      ? (sort as CatalogSort)
      : params.get("q")?.trim()
        ? "relevance"
        : "recent",
  };
}

/** Always bounded, even if the catalog has tens of thousands of result pages. */
export function paginationPages(
  current: number,
  total: number,
): (number | "gap-before" | "gap-after")[] {
  const numbers = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  return numbers.flatMap((page, index) => {
    const previous = numbers[index - 1];
    return previous && page > previous + 1
      ? [index === 1 ? ("gap-before" as const) : ("gap-after" as const), page]
      : [page];
  });
}

export function catalogConcepts(catalog: Catalog) {
  const counts = new Map<string, number>();
  for (const paper of catalog.papers)
    for (const id of paper.concepts) counts.set(id, (counts.get(id) ?? 0) + 1);
  return catalog.concepts
    .map((concept) => ({ ...concept, count: counts.get(concept.id) ?? 0 }))
    .filter((concept) => concept.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "it"));
}

let languageDisplay: Intl.DisplayNames | null;
try {
  languageDisplay = new Intl.DisplayNames(["it"], { type: "language" });
} catch {
  languageDisplay = null;
}
export function languageLabel(code: string): string {
  const name = languageDisplay?.of(code);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
}
