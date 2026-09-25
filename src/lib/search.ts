import type { PDFDocumentProxy } from "pdfjs-dist";

export interface SearchMatch {
  page: number; // 1-indexed pdf.js page number
  snippet: string;
  /** Which occurrence of the query text on this page (0-indexed), for locating the right DOM span. */
  occurrenceOnPage: number;
}

/** Scans every page's text content (independent of whether it has been rendered/lazy-loaded yet) for a query. */
export async function findMatches(doc: PDFDocumentProxy, query: string): Promise<SearchMatch[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: SearchMatch[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let occurrenceOnPage = 0;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (str.toLowerCase().includes(needle)) {
        matches.push({ page: pageNumber, snippet: str.trim().slice(0, 80), occurrenceOnPage });
        occurrenceOnPage++;
      }
    }
  }
  return matches;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrolls a match's page into view (triggering its lazy render if needed), then finds and
 * briefly highlights the matched span once the page's text layer has finished rendering.
 */
export async function highlightMatchInDom(match: SearchMatch, query: string) {
  const container = document.getElementById(`page-${match.page}`);
  if (!container) return;
  container.scrollIntoView({ block: "center", behavior: "smooth" });

  const needle = query.trim().toLowerCase();
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const spans = Array.from(container.querySelectorAll<HTMLElement>(".textLayer span"));
    if (spans.length > 0) {
      let seen = 0;
      for (const span of spans) {
        if ((span.textContent ?? "").toLowerCase().includes(needle)) {
          if (seen === match.occurrenceOnPage) {
            span.scrollIntoView({ block: "center", behavior: "smooth" });
            span.classList.add("search-match-flash");
            setTimeout(() => span.classList.remove("search-match-flash"), 1800);
            return;
          }
          seen++;
        }
      }
      return;
    }
    await sleep(100);
  }
}
