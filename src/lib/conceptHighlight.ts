import type { PDFDocumentProxy } from "pdfjs-dist";

/** One occurrence of a concept in the PDF: its page and its position among that page's occurrences. */
export interface Occurrence {
  page: number; // 1-indexed pdf.js page number
  indexOnPage: number;
}

const MARK_CLASS = "concept-mark";

// A page's text is matched as one string, not item by item: pdf.js splits math and symbols into
// separate items ("t|ket⟩" comes out as "|", "ket", "〉"), and terms wrap across lines. Both sides
// build that string the same way — items (= text-layer spans) in order, "\n" after an end of line
// (= the text layer's <br>) — so the nth occurrence counted here is the nth one marked in the DOM.

// Every page's text, fetched once per document: counting a concept's occurrences needs all pages
// (most haven't lazily rendered a text layer yet), and the user may open many concepts.
const pageTextCache = new WeakMap<PDFDocumentProxy, Promise<string[]>>();

function pageTexts(doc: PDFDocumentProxy): Promise<string[]> {
  let cached = pageTextCache.get(doc);
  if (!cached) {
    cached = (async () => {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        pages.push(content.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : "") : "")).join(""));
      }
      return pages;
    })();
    pageTextCache.set(doc, cached);
  }
  return cached;
}

function matchRanges(text: string, pattern: RegExp): [number, number][] {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
}

/** All occurrences of `pattern` across the document, in page order. */
export async function findOccurrences(doc: PDFDocumentProxy, pattern: RegExp): Promise<Occurrence[]> {
  const occurrences: Occurrence[] = [];
  (await pageTexts(doc)).forEach((text, i) => {
    matchRanges(text, pattern).forEach((_, indexOnPage) => occurrences.push({ page: i + 1, indexOnPage }));
  });
  return occurrences;
}

function flatten(layer: HTMLElement) {
  const spans = new Set<HTMLElement>();
  for (const mark of layer.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`)) {
    if (mark.parentElement) spans.add(mark.parentElement);
  }
  for (const span of spans) span.textContent = span.textContent ?? "";
}

/** (Re)marks one page's text layer, unless it's already marked for exactly this content and pattern. */
function markLayer(layer: HTMLElement, pattern: RegExp) {
  // Leaf spans (pdf.js wraps marked content in span.markedContent) and line breaks, in document order.
  const nodes = [...layer.querySelectorAll<HTMLElement>("span:not(.markedContent), br")];
  const signature = `${pattern.source}|${nodes.length}`;
  if (layer.dataset.conceptMarks === signature) return;
  flatten(layer);

  const spans: { span: HTMLElement; start: number; end: number }[] = [];
  let text = "";
  for (const node of nodes) {
    if (node.tagName === "BR") {
      text += "\n";
    } else {
      const content = node.textContent ?? "";
      spans.push({ span: node, start: text.length, end: text.length + content.length });
      text += content;
    }
  }

  // Per span, the local [start, end) ranges to wrap, each tagged with its occurrence number.
  const ranges = new Map<HTMLElement, [number, number, number][]>();
  matchRanges(text, pattern).forEach(([start, end], occurrence) => {
    for (const s of spans) {
      if (s.end <= start || s.start >= end) continue;
      const list = ranges.get(s.span) ?? [];
      list.push([Math.max(start, s.start) - s.start, Math.min(end, s.end) - s.start, occurrence]);
      ranges.set(s.span, list);
    }
  });

  for (const [span, list] of ranges) {
    const content = span.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let last = 0;
    for (const [start, end, occurrence] of list) {
      if (start > last) fragment.append(content.slice(last, start));
      const mark = document.createElement("mark");
      mark.className = MARK_CLASS;
      mark.dataset.occurrence = String(occurrence);
      mark.textContent = content.slice(start, end);
      fragment.append(mark);
      last = end;
    }
    if (last < content.length) fragment.append(content.slice(last));
    span.replaceChildren(fragment);
  }
  layer.dataset.conceptMarks = signature;
}

/**
 * Marks every match of `pattern` in the text layers under `root`. Safe to call repeatedly (e.g.
 * from a MutationObserver): a layer is only redone when its content (lazy render, zoom rebuild)
 * or the pattern changed.
 */
export function markTextLayers(root: HTMLElement, pattern: RegExp) {
  for (const layer of root.querySelectorAll<HTMLElement>(".textLayer")) markLayer(layer, pattern);
}

/** Undoes markTextLayers. */
export function unmarkTextLayers(root: HTMLElement) {
  for (const layer of root.querySelectorAll<HTMLElement>(".textLayer")) {
    flatten(layer);
    delete layer.dataset.conceptMarks;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrolls an occurrence into view: first its page (triggering its lazy render), then — once the
 * text layer is up and marked — the occurrence itself, which is emphasized briefly.
 */
export async function scrollToOccurrence(occurrence: Occurrence) {
  const page = document.getElementById(`page-${occurrence.page}`);
  if (!page) return;
  page.scrollIntoView({ block: "center", behavior: "smooth" });
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const marks = [...page.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}[data-occurrence="${occurrence.indexOnPage}"]`)];
    if (marks.length > 0) {
      marks[0].scrollIntoView({ block: "center", behavior: "smooth" });
      for (const mark of marks) mark.classList.add("is-current");
      setTimeout(() => marks.forEach((mark) => mark.classList.remove("is-current")), 1800);
      return;
    }
    await sleep(100);
  }
}
