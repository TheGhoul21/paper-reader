import type { Variant } from "../types";

// Paper requests go through GitHub issues (protocol: docs/paper-requests.md). The reader only
// builds links: finding the paper and checking its licence happen at import time
// (find_paper.py), since arXiv's API has no CORS and Google Scholar has no API.

const REPO = "TheGhoul21/paper-reader";
const TEMPLATE = "paper-request.yml";

// Option labels of the issue form's dropdowns (.github/ISSUE_TEMPLATE/paper-request.yml) — GitHub
// prefills a dropdown only when the query value matches an option exactly.
const LEVEL_OPTIONS: Record<Variant["level"], string> = {
  beginner: "Nessun background (beginner)",
  intermediate: "Laurea in un campo affine (intermediate)",
  expert: "Esperto del sottocampo (expert)",
};
const LANGUAGE_OPTIONS: Record<string, string> = { it: "Italiano", en: "English" };

const ARXIV_ID = /(?:arxiv[:\s/]*|abs\/|pdf\/)?(\d{4}\.\d{4,5})(?:v\d+)?/i;
const DOI = /\b(10\.\d{4,9}\/[^\s"<>]+[^\s"<>.,;])/;

/** "[24] Daniel Litinski (2019): A Game of…" → marker "[24]" and the entry without it. */
function splitMarker(reference: string): { marker: string | null; body: string } {
  const m = reference.match(/^\s*(\[\d{1,3}\]|\d{1,3}\.)\s*/);
  return m
    ? { marker: m[1], body: reference.slice(m[0].length) }
    : { marker: null, body: reference };
}

/**
 * Best guess at the title inside a bibliography entry: a quoted title (IEEE style), else the text
 * after "Authors (2019):" up to the next sentence end (EPTCS/Springer style), else null.
 */
export function guessTitle(reference: string): string | null {
  const { body } = splitMarker(reference);
  const quoted = body.match(/[“"]([^”"]{15,})[”"]/);
  if (quoted) return quoted[1].replace(/[,.]\s*$/, "").trim();
  const afterYear = body.match(/\((?:19|20)\d{2}[a-z]?\)\s*[:.]\s*(.+?)(?:\.\s|$)/);
  if (afterYear && afterYear[1].split(/\s+/).length >= 3) return afterYear[1].trim();
  return null;
}

export interface CitationLinks {
  arxiv: string | null; // direct abstract link, when the entry carries an arXiv id
  doi: string | null;
  arxivSearch: string;
  scholar: string;
}

export function citationLinks(reference: string): CitationLinks {
  const { body } = splitMarker(reference);
  const arxivId = body.match(/arxiv/i) ? (body.match(ARXIV_ID)?.[1] ?? null) : null;
  const doi = body.match(DOI)?.[1] ?? null;
  const query = body.replace(/\s+/g, " ").trim().slice(0, 300);
  const title = guessTitle(reference);
  return {
    arxiv: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
    doi: doi ? `https://doi.org/${doi}` : null,
    // arXiv ANDs every term, so the whole entry (authors, venue, pages) finds nothing: search the title.
    arxivSearch: title
      ? `https://arxiv.org/search/?query=${encodeURIComponent(title)}&searchtype=title`
      : `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all`,
    scholar: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  };
}

/** New-issue URL for the paper-request form, prefilled with whatever is known. */
export function paperRequestUrl(
  options: {
    reference?: string;
    sourceSlug?: string;
    variant?: Variant;
  } = {},
): string {
  const params = new URLSearchParams({ template: TEMPLATE });
  if (options.reference) {
    const { marker, body } = splitMarker(options.reference);
    const links = citationLinks(options.reference);
    params.set(
      "title",
      `[Paper] ${(guessTitle(options.reference) ?? body.replace(/\s+/g, " ")).slice(0, 120)}`,
    );
    params.set("reference", options.reference);
    const link = links.arxiv ?? links.doi;
    if (link) params.set("link", link);
    if (options.sourceSlug)
      params.set(
        "source",
        marker ? `${options.sourceSlug}, riferimento ${marker}` : options.sourceSlug,
      );
  }
  if (options.variant) {
    params.set("level", LEVEL_OPTIONS[options.variant.level]);
    const language = LANGUAGE_OPTIONS[options.variant.language];
    if (language) params.set("language", language);
  }
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
