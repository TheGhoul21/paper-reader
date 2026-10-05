/**
 * Catalog entries contain only the information needed to find and choose a paper.
 * Concepts and aliases come from the authored glossary, never a generated taxonomy.
 * Page coverage counts anchors; it deliberately makes no claim of editorial completeness.
 */
export function buildCatalog(library, readPaper) {
  const concepts = new Map();
  const papers = library.map((entry) => {
    const { meta, paragraphs = [], glossary = [], structure } = readPaper(entry.slug);
    const summary = entry.tldr?.[entry.language] ?? Object.values(entry.tldr ?? {})[0];
    const explainedPages = new Set();
    for (const paragraph of paragraphs) {
      if (!Object.values(paragraph.explanations ?? {}).some((text) => text.trim())) continue;
      for (const anchor of paragraph.anchors ?? [paragraph]) explainedPages.add(anchor.page);
    }
    const conceptIds = [];
    for (const concept of glossary) {
      const previous = concepts.get(concept.id);
      const spellings = new Set([
        ...(previous?.aliases ?? []),
        ...(previous ? [previous.term] : []),
        concept.term,
        ...(concept.aliases ?? []),
      ]);
      const term = previous?.term ?? concept.term;
      spellings.delete(term);
      concepts.set(concept.id, { id: concept.id, term, aliases: [...spellings].sort() });
      conceptIds.push(concept.id);
    }
    const identifiers = [];
    if (meta.sourceType === "arxiv") {
      const match = meta.sourceRef?.match(
        /(?:arxiv\.org\/(?:abs|pdf)\/)?((?:\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(?:v\d+)?)/i,
      );
      if (match) identifiers.push(match[1], `arXiv:${match[1]}`);
    }
    const doi = meta.sourceRef?.match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0];
    if (doi) identifiers.push(doi.replace(/\/$/, ""));
    return {
      slug: entry.slug,
      title: entry.title,
      authors: entry.authors,
      importedAt: entry.importedAt,
      pageCount: entry.pageCount,
      variants: entry.variants,
      problem: summary?.problem.split(/(?<=[.!?])\s+/)[0] ?? "",
      // Full problem/idea text remains searchable without downloading paper content.
      summary: Object.values(entry.tldr ?? {})
        .map((value) => `${value.problem} ${value.idea}`)
        .join(" "),
      identifiers: [...new Set(identifiers)],
      concepts: [...new Set(conceptIds)],
      guideSteps: (structure?.readingGuide ?? []).reduce(
        (count, section) => count + section.steps.length,
        0,
      ),
      explainedPages: explainedPages.size,
    };
  });
  return {
    version: 1,
    concepts: [...concepts.values()].sort((a, b) => a.id.localeCompare(b.id)),
    papers,
  };
}
