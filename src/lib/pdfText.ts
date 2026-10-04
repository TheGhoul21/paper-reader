import type { PDFDocumentProxy } from "pdfjs-dist";

const pages = new WeakMap<PDFDocumentProxy, Map<number, Promise<string>>>();

/** Same string as pdf.js's text layer: text spans in order, with BR for hasEOL. */
export function pageText(doc: PDFDocumentProxy, number: number): Promise<string> {
  let cache = pages.get(doc);
  if (!cache) {
    cache = new Map();
    pages.set(doc, cache);
  }
  let text = cache.get(number);
  if (!text) {
    text = doc
      .getPage(number)
      .then((page) => page.getTextContent())
      .then((content) =>
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
          .join(""),
      )
      .catch((error) => {
        cache!.delete(number);
        throw error;
      });
    cache.set(number, text);
  }
  return text;
}

/** Case/ligature/whitespace normalization with offsets back into the original PDF text. */
export function normalizeSearchText(source: string): {
  text: string;
  starts: number[];
  ends: number[];
} {
  let text = "";
  const starts: number[] = [],
    ends: number[] = [];
  for (let i = 0; i < source.length;) {
    const char = String.fromCodePoint(source.codePointAt(i)!);
    const start = i;
    i += char.length;
    if (char === "\u00ad") continue;
    // Remove a word's printed hyphen at a line break, keeping mathematical minus signs.
    if (
      char === "-" &&
      /\p{L}/u.test(source[start - 1] ?? "") &&
      /^\s*\n\s*\p{Ll}/u.test(source.slice(i))
    ) {
      i += source.slice(i).match(/^\s*\n\s*/u)![0].length;
      continue;
    }
    if (/\s/u.test(char)) {
      while (i < source.length && /\s/u.test(source[i])) i++;
      if (!text || text.endsWith(" ")) continue;
      text += " ";
      starts.push(start);
      ends.push(i);
    } else {
      const normalized = char.normalize("NFKC").toLowerCase();
      text += normalized;
      for (let j = 0; j < normalized.length; j++) {
        starts.push(start);
        ends.push(i);
      }
    }
  }
  return { text, starts, ends };
}

export function textLayerSpans(layer: HTMLElement): {
  text: string;
  spans: { element: HTMLElement; start: number; end: number }[];
} {
  let text = "";
  const spans: { element: HTMLElement; start: number; end: number }[] = [];
  for (const element of layer.querySelectorAll<HTMLElement>("span:not(.markedContent), br")) {
    if (element.tagName === "BR") text += "\n";
    else {
      const start = text.length;
      text += element.textContent ?? "";
      spans.push({ element, start, end: text.length });
    }
  }
  return { text, spans };
}
