import { papersUrl } from "./paths";
import { paragraphAnchors } from "./paragraphs.ts";
import type {
  Concept,
  ConceptsIndex,
  LibraryEntry,
  PaperMeta,
  PaperStructure,
  Paragraph,
} from "../types";

export interface PaperData {
  meta: PaperMeta;
  paragraphs: Paragraph[];
  concepts: Concept[];
  conceptsIndex: ConceptsIndex;
  structure: PaperStructure | null;
  numbers: Map<string, number>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** The library manifest is a separate input contract, not an unchecked cast. */
export function parseLibrary(value: unknown): LibraryEntry[] {
  if (!Array.isArray(value)) throw new Error("index.json: atteso un elenco di paper.");
  const slugs = new Set<string>();
  for (const entry of value) {
    if (
      !record(entry) ||
      !nonempty(entry.slug) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(entry.slug) ||
      slugs.has(entry.slug) ||
      !nonempty(entry.title) ||
      !Array.isArray(entry.authors) ||
      !entry.authors.every((a) => typeof a === "string") ||
      !nonempty(entry.language) ||
      typeof entry.background !== "string" ||
      !nonempty(entry.importedAt) ||
      !Number.isFinite(Date.parse(entry.importedAt)) ||
      !Number.isInteger(entry.pageCount) ||
      Number(entry.pageCount) < 1 ||
      !Array.isArray(entry.variants) ||
      !entry.variants.length ||
      entry.variants.some(
        (v) =>
          !record(v) ||
          !nonempty(v.key) ||
          !nonempty(v.label) ||
          !nonempty(v.language) ||
          !["beginner", "intermediate", "expert"].includes(String(v.level)),
      )
    ) {
      throw new Error(
        `index.json: voce non valida (${record(entry) ? String(entry.slug) : "paper"}).`,
      );
    }
    validateSummary(entry.tldr, `index.json: ${entry.slug}`);
    slugs.add(entry.slug);
  }
  return value as LibraryEntry[];
}

function validateSummary(value: unknown, where: string) {
  if (value === undefined) return;
  if (
    !record(value) ||
    Object.values(value).some(
      (t) =>
        !record(t) ||
        !nonempty(t.problem) ||
        !nonempty(t.idea) ||
        !nonempty(t.result) ||
        (t.why !== undefined && typeof t.why !== "string"),
    )
  )
    throw new Error(`${where}: riepilogo non valido.`);
}

/** Validate downloaded data before the reader or the review screen consumes it. */
export function parsePaper(
  slug: string,
  meta: unknown,
  paragraphs: unknown,
  concepts: unknown,
  structure: unknown,
  conceptsIndex: unknown,
): PaperData {
  const invalid = (where: string): never => {
    throw new Error(`${slug}: dati del paper non validi (${where}).`);
  };
  if (
    !record(meta) ||
    meta.slug !== slug ||
    !nonempty(meta.title) ||
    !Array.isArray(meta.authors) ||
    !meta.authors.every((a) => typeof a === "string") ||
    !Number.isInteger(meta.pageCount) ||
    Number(meta.pageCount) < 1 ||
    !Array.isArray(meta.variants) ||
    meta.variants.length === 0
  )
    invalid("meta.json");
  const m = meta as unknown as PaperMeta;
  validateSummary(m.tldr, `${slug}: meta.json`);
  const variantTexts = (value: unknown) =>
    record(value) && m.variants.every((v) => nonempty(value[v.key]));
  if (
    (m.sourceSha256 !== undefined && !/^[a-f0-9]{64}$/.test(m.sourceSha256)) ||
    (m.sourceVersion !== undefined && !/^v[1-9]\d*$/.test(m.sourceVersion))
  )
    invalid("source identity");
  if (
    m.variants.some(
      (v) =>
        !record(v) ||
        !nonempty(v.key) ||
        !nonempty(v.language) ||
        !nonempty(v.label) ||
        !["beginner", "intermediate", "expert"].includes(v.level),
    ) ||
    new Set(m.variants.map((v) => v.key)).size !== m.variants.length
  )
    invalid("variants");
  if (!Array.isArray(paragraphs)) invalid("paragraphs.json");
  const ps = paragraphs as Paragraph[];
  const ids = new Set<string>();
  for (const p of ps) {
    if (
      !record(p) ||
      !nonempty(p.id) ||
      ids.has(p.id) ||
      !nonempty(p.sourceText) ||
      !record(p.explanations) ||
      !Number.isInteger(p.order) ||
      !Number.isInteger(p.page)
    )
      invalid("paragraph");
    ids.add(p.id);
    if (m.variants.some((v) => !nonempty(p.explanations[v.key]))) invalid(`${p.id}: explanations`);
    if (p.anchors !== undefined && (!Array.isArray(p.anchors) || p.anchors.length === 0))
      invalid(`${p.id}: anchors`);
    for (const a of paragraphAnchors(p)) {
      if (
        !record(a) ||
        !Number.isInteger(a.page) ||
        a.page < 0 ||
        a.page >= m.pageCount ||
        !Array.isArray(a.rects) ||
        !a.rects.length ||
        a.rects.some(
          (r) =>
            !Array.isArray(r) ||
            r.length !== 4 ||
            r.some((n) => !Number.isFinite(n) || n < 0 || n > 1) ||
            r[0] >= r[2] ||
            r[1] >= r[3],
        )
      )
        invalid(`${p.id}: coordinates`);
    }
    const first = paragraphAnchors(p)[0];
    if (p.page !== first.page || JSON.stringify(p.rects) !== JSON.stringify(first.rects))
      invalid(`${p.id}: first anchor`);
  }
  if (!Array.isArray(concepts)) invalid("concepts.json");
  const cs = concepts as Concept[];
  const conceptIds = new Set<string>();
  for (const c of cs) {
    if (
      !record(c) ||
      !nonempty(c.id) ||
      conceptIds.has(c.id) ||
      !nonempty(c.term) ||
      !ids.has(c.definedIn) ||
      !Array.isArray(c.aliases) ||
      !c.aliases.every((s) => typeof s === "string") ||
      !Array.isArray(c.related) ||
      !record(c.definitions) ||
      m.variants.some((v) => !nonempty(c.definitions[v.key]))
    )
      invalid("concept");
    conceptIds.add(c.id);
  }
  if (cs.some((c) => c.related.some((id) => !conceptIds.has(id)))) invalid("related concepts");
  for (const c of cs) {
    if (
      c.pdfTerms !== undefined &&
      (!Array.isArray(c.pdfTerms) || c.pdfTerms.some((term) => !nonempty(term)))
    )
      invalid(`${c.id}: pdfTerms`);
  }
  for (const p of ps) {
    if (p.section !== undefined && typeof p.section !== "string") invalid(`${p.id}: section`);
    if (p.notebookSuggestion !== undefined && typeof p.notebookSuggestion !== "string")
      invalid(`${p.id}: notebookSuggestion`);
    if (
      p.deepDive !== undefined &&
      (!record(p.deepDive) || Object.values(p.deepDive).some((text) => !nonempty(text)))
    )
      invalid(`${p.id}: deepDive`);
    if (
      p.leadsTo !== undefined &&
      (!Array.isArray(p.leadsTo) ||
        p.leadsTo.some((link) => !record(link) || !ids.has(link.to) || !variantTexts(link.why)))
    )
      invalid(`${p.id}: leadsTo`);
    if (p.recall !== undefined) {
      if (!Array.isArray(p.recall)) invalid(`${p.id}: recall`);
      const questions = new Set<string>();
      for (const question of p.recall) {
        if (
          !record(question) ||
          !nonempty(question.id) ||
          questions.has(question.id) ||
          !variantTexts(question.q) ||
          !variantTexts(question.a)
        )
          invalid(`${p.id}: recall question`);
        questions.add(question.id);
      }
    }
  }
  if (
    structure !== null &&
    (!record(structure) || !record(structure.thesis) || !Array.isArray(structure.claims))
  )
    invalid("structure.json");
  const st = structure as PaperStructure | null;
  if (st) {
    if (!variantTexts(st.thesis)) invalid("structure thesis");
    if (st.figures !== undefined) {
      if (!Array.isArray(st.figures)) invalid("figures");
      const figureIds = new Set<string>();
      for (const figure of st.figures) {
        if (
          !record(figure) ||
          !nonempty(figure.id) ||
          figureIds.has(figure.id) ||
          !nonempty(figure.label) ||
          !Number.isInteger(figure.page) ||
          figure.page < 0 ||
          figure.page >= m.pageCount ||
          !Array.isArray(figure.rect) ||
          figure.rect.length !== 4 ||
          figure.rect.some((n) => !Number.isFinite(n) || n < 0 || n > 1) ||
          figure.rect[0] >= figure.rect[2] ||
          figure.rect[1] >= figure.rect[3] ||
          typeof figure.image !== "string" ||
          !/^figures\/[a-z0-9][a-z0-9-]*\.png$/.test(figure.image) ||
          !/^[a-f0-9]{64}$/.test(String(figure.sourceSha256)) ||
          figure.sourceSha256 !== m.sourceSha256 ||
          !variantTexts(figure.caption) ||
          !ids.has(figure.captionParagraph) ||
          !ps.some(
            (p) =>
              p.id === figure.captionParagraph &&
              paragraphAnchors(p).some((a) => a.page === figure.page),
          ) ||
          !Array.isArray(figure.references) ||
          !figure.references.length ||
          figure.references.some(
            (r) =>
              !record(r) ||
              !ids.has(r.paragraphId) ||
              (r.panel !== undefined && !["a", "b", "c"].includes(r.panel)),
          ) ||
          new Set(figure.references.map((r) => r.paragraphId)).size !== figure.references.length ||
          (figure.animation !== undefined &&
            !["parity-twine", "oqft-blocks", "atom-transport", "canvas-projection"].includes(
              figure.animation,
            ))
        )
          invalid("figure");
        figureIds.add(figure.id);
      }
    }
    const claims = new Set(st.claims.map((claim) => claim?.id));
    if (claims.size !== st.claims.length) invalid("duplicate claims");
    for (const c of st.claims) {
      if (
        !record(c) ||
        !nonempty(c.id) ||
        !record(c.title) ||
        !record(c.summary) ||
        !Array.isArray(c.statedIn) ||
        !Array.isArray(c.evidence) ||
        !Array.isArray(c.dependsOn) ||
        [...c.statedIn, ...c.evidence].some((id) => !ids.has(id))
      )
        invalid("claim");
      if (
        !variantTexts(c.title) ||
        !variantTexts(c.summary) ||
        c.dependsOn.some((id) => !claims.has(id))
      )
        invalid(`${c.id}: claim texts or dependencies`);
    }
    if (st.readingGuide !== undefined) {
      if (!Array.isArray(st.readingGuide)) invalid("readingGuide");
      for (const section of st.readingGuide) {
        if (
          !record(section) ||
          !nonempty(section.id) ||
          !record(section.title) ||
          !record(section.goal) ||
          !Array.isArray(section.steps)
        )
          invalid("reading section");
        if (!variantTexts(section.title) || !variantTexts(section.goal))
          invalid(`${section.id}: reading section texts`);
        for (const step of section.steps) {
          if (
            !record(step) ||
            !nonempty(step.id) ||
            !record(step.title) ||
            !record(step.meaning) ||
            !record(step.purpose) ||
            !Array.isArray(step.paragraphs) ||
            step.paragraphs.some((id) => !ids.has(id))
          )
            invalid("reading step");
          if (
            !variantTexts(step.title) ||
            !variantTexts(step.meaning) ||
            !variantTexts(step.purpose)
          )
            invalid(`${step.id}: reading step texts`);
          if (
            step.diagram !== undefined &&
            (!record(step.diagram) ||
              !nonempty(step.diagram.path) ||
              !variantTexts(step.diagram.caption))
          )
            invalid(`${step.id}: diagram`);
        }
      }
    }
  }
  if (!record(conceptsIndex)) invalid("concepts-index.json");
  for (const [id, entries] of Object.entries(conceptsIndex as Record<string, unknown>)) {
    if (
      !Array.isArray(entries) ||
      entries.some(
        (entry) =>
          !record(entry) ||
          [entry.slug, entry.title, entry.term, entry.definedIn, entry.definition].some(
            (field) => !nonempty(field),
          ),
      )
    )
      invalid(`concepts-index.json: ${id}`);
  }
  const ordered = [...ps].sort((a, b) => a.page - b.page || a.order - b.order);
  return {
    meta: m,
    paragraphs: ps,
    concepts: cs,
    conceptsIndex: conceptsIndex as ConceptsIndex,
    structure: st,
    numbers: new Map(ordered.map((p, i) => [p.id, i + 1])),
  };
}

async function json(path: string, signal: AbortSignal, fallback?: unknown): Promise<unknown> {
  const response = await fetch(papersUrl(path), { signal });
  // Vite's SPA fallback answers an absent optional JSON file with HTML.
  if (
    fallback !== undefined &&
    (response.status === 404 ||
      (response.ok && response.headers.get("content-type")?.includes("text/html")))
  )
    return fallback;
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

/** Shared loads; cancelling one consumer does not cancel another consumer's paper. */
export function createPaperLoader() {
  const cache = new Map<string, PaperData>();
  const pending = new Map<
    string,
    { controller: AbortController; promise: Promise<PaperData>; consumers: number }
  >();
  return function loadPaper(slug: string, signal?: AbortSignal): Promise<PaperData> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    if (cache.has(slug)) return Promise.resolve(cache.get(slug)!);
    let entry = pending.get(slug);
    if (!entry) {
      const controller = new AbortController();
      const promise = Promise.all([
        json(`${slug}/meta.json`, controller.signal),
        json(`${slug}/paragraphs.json`, controller.signal),
        json(`${slug}/concepts.json`, controller.signal, []),
        json(`${slug}/structure.json`, controller.signal, null),
        json("concepts-index.json", controller.signal, {}),
      ])
        .then(([m, p, c, st, ci]) => {
          const data = parsePaper(slug, m, p, c, st, ci);
          if (!controller.signal.aborted) cache.set(slug, data);
          return data;
        })
        .finally(() => {
          if (pending.get(slug)?.controller === controller) pending.delete(slug);
        });
      entry = { controller, promise, consumers: 0 };
      pending.set(slug, entry);
    }
    const request = entry;
    request.consumers++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", abort);
        request.consumers--;
        return true;
      };
      const abort = () => {
        if (!finish()) return;
        if (request.consumers === 0) {
          request.controller.abort();
          pending.delete(slug);
        }
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      request.promise.then(
        (data) => {
          if (finish()) resolve(data);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );
    });
  };
}

export const loadPaper = createPaperLoader();
