import type { PDFDocumentProxy } from "pdfjs-dist";
import { waitForElement } from "./pdfNavigation.ts";
import { normalizeSearchText, pageText, textLayerSpans } from "./pdfText.ts";

export interface SearchMatch {
  page: number; // 1-indexed pdf.js page number
  snippet: string;
  /** Which occurrence of the query text on this page (0-indexed), for locating the right DOM span. */
  occurrenceOnPage: number;
  /** Exact range in the page's original text; occurrences in one span stay distinct. */
  start: number;
  end: number;
}

/** Scans every page's text content (independent of whether it has been rendered/lazy-loaded yet) for a query. */
export async function findMatches(
  doc: PDFDocumentProxy,
  query: string,
  signal?: AbortSignal,
): Promise<SearchMatch[]> {
  const needle = normalizeSearchText(query).text.trim();
  if (!needle) return [];

  const matches: SearchMatch[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const source = await pageText(doc, pageNumber);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const normalized = normalizeSearchText(source);
    let occurrenceOnPage = 0;
    let position = 0;
    while ((position = normalized.text.indexOf(needle, position)) !== -1) {
      const start = normalized.starts[position];
      const end = normalized.ends[position + needle.length - 1];
      matches.push({
        page: pageNumber,
        snippet: source
          .slice(Math.max(0, start - 25), end + 45)
          .replace(/\s+/g, " ")
          .trim(),
        occurrenceOnPage,
        start,
        end,
      });
      occurrenceOnPage++;
      position += needle.length;
    }
  }
  return matches;
}

/**
 * Scrolls a match's page into view (triggering its lazy render if needed), then finds and
 * briefly highlights the matched span once the page's text layer has finished rendering.
 */
export async function highlightMatchInDom(match: SearchMatch, query: string, signal?: AbortSignal) {
  if (signal?.aborted) return;
  const container = document.getElementById(`page-${match.page}`);
  if (!container) return;
  container.scrollIntoView({ block: "center", behavior: "smooth" });

  if (!query.trim()) return;
  const layer = await waitForElement(
    container,
    () => {
      const candidate = container.querySelector<HTMLElement>(".textLayer");
      return candidate?.dataset.rendered === "true" ? candidate : null;
    },
    signal,
  );
  if (!layer || signal?.aborted || !container.isConnected) return;
  const { spans } = textLayerSpans(layer);
  const hit = spans.filter((s) => s.end > match.start && s.start < match.end);
  if (!hit.length) return;
  document.querySelectorAll(".search-result-marker").forEach((marker) => marker.remove());
  const pageBox = container.getBoundingClientRect();
  const markers: HTMLElement[] = [];
  function point(span: HTMLElement, offset: number): [Node, number] | null {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (offset <= length) return [node, offset];
      offset -= length;
    }
    return null;
  }
  for (const s of hit) {
    const start = point(s.element, Math.max(0, match.start - s.start));
    const end = point(s.element, Math.min(s.end, match.end) - s.start);
    if (!start || !end) continue;
    const range = document.createRange();
    range.setStart(...start);
    range.setEnd(...end);
    for (const rect of range.getClientRects()) {
      const marker = document.createElement("div");
      marker.className = "search-result-marker";
      Object.assign(marker.style, {
        left: `${rect.left - pageBox.left}px`,
        top: `${rect.top - pageBox.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      container.append(marker);
      markers.push(marker);
    }
  }
  (markers[0] ?? hit[0].element).scrollIntoView({ block: "center", behavior: "smooth" });
  const clear = () => {
    markers.forEach((marker) => marker.remove());
    signal?.removeEventListener("abort", clear);
  };
  signal?.addEventListener("abort", clear, { once: true });
  setTimeout(clear, 1800);
  return;
}
