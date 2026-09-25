import type { PDFDocumentProxy } from "pdfjs-dist";

// pdf.js's RefProxy and TextItem types aren't re-exported from the package root; the shapes
// below are the minimal slices of each that this module actually reads.
type RefProxy = { num: number; gen: number };
type TextItem = { str: string; transform: number[] };

export type LinkTarget =
  | { type: "citation"; pageNumber: number; text: string }
  | { type: "jump"; pageNumber: number };

interface TextLine {
  x: number;
  y: number;
  text: string;
}

const LINE_Y_TOLERANCE = 2;
const MARGIN_X_TOLERANCE = 4;
const MAX_LINES = 30;
const MAX_CHARS = 2000;
const MAX_ANCHOR_CORRECTIONS = 4;

// A bibliography entry's own marker, e.g. "[12] " or "12. ".
const START_MARKER = /^(\[\d{1,3}\]|\d{1,3}\.)\s+\S/;
// A second entry's marker appearing later in the extracted text — a sign two entries got
// merged (packed/run-on bibliography layouts, or an anchor that overshot into a neighbor).
const EMBEDDED_MARKER = /(\[\d{1,3}\]|(?<=[.:]\s)\d{1,3}\.)\s+[A-Z]/;

async function resolveDestination(
  doc: PDFDocumentProxy,
  dest: string | unknown[],
): Promise<{ pageNumber: number; left: number | null; top: number | null } | null> {
  let d: unknown = dest;
  if (typeof d === "string") {
    try {
      d = await doc.getDestination(d);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(d) || d.length === 0) return null;

  let pageIndex: number;
  try {
    pageIndex = await doc.getPageIndex(d[0] as RefProxy);
  } catch {
    return null;
  }

  const view = d[1] as { name?: string } | undefined;
  let left: number | null = null;
  let top: number | null = null;
  if (view?.name === "XYZ") {
    left = typeof d[2] === "number" ? (d[2] as number) : null;
    top = typeof d[3] === "number" ? (d[3] as number) : null;
  } else if (view?.name === "FitH" || view?.name === "FitBH") {
    top = typeof d[2] === "number" ? (d[2] as number) : null;
  }
  return { pageNumber: pageIndex + 1, left, top };
}

function buildLines(items: TextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  for (const item of items) {
    const str = item.str;
    if (!str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= LINE_Y_TOLERANCE) {
      last.text += (last.text.endsWith(" ") || str.startsWith(" ") ? "" : " ") + str.trim();
    } else {
      lines.push({ x, y, text: str.trim() });
    }
  }
  return lines;
}

function modeX(lines: TextLine[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.x);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let mode = 0;
  let best = 0;
  for (const [x, count] of counts) {
    if (count > best) {
      best = count;
      mode = x;
    }
  }
  return mode;
}

/**
 * Extracts the bibliography entry nearest a citation link's destination, using the PDF's
 * hanging-indent convention (an entry's own line starts further left than its wrapped
 * continuation lines) to find where it begins and ends.
 *
 * pdf.js's destination "top" is meant to land right at the target line, but pdflatex/hyperref
 * commonly snaps it to the *previous* entry's last line instead — so after finding the first
 * line at or below `top`, we walk forward past any further continuation lines until we hit an
 * actual dedent (the true entry start).
 *
 * The result is only trustworthy when it looks like one complete, self-contained reference —
 * chiefly because reference lists come in layouts this line-based approach can't parse at all
 * (e.g. several entries packed onto one line) — so the caller should discard it when the text
 * doesn't start with a numbered marker or contains a second one further in.
 */
async function extractReferenceEntry(
  doc: PDFDocumentProxy,
  pageNumber: number,
  left: number | null,
  top: number,
): Promise<{ pageNumber: number; text: string } | null> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items: TextItem[] = content.items.flatMap((i) => ("str" in i ? [{ str: i.str, transform: i.transform }] : []));
  const lines = buildLines(items);
  if (lines.length === 0) return null;

  let startIndex = lines.findIndex((l) => l.y <= top);
  if (startIndex < 0) startIndex = lines.length - 1;

  const indentX = modeX(lines);
  let corrections = 0;
  while (
    startIndex < lines.length - 1 &&
    Math.abs(lines[startIndex].x - indentX) <= MARGIN_X_TOLERANCE &&
    corrections++ < MAX_ANCHOR_CORRECTIONS
  ) {
    startIndex++;
  }

  const marginX = lines[startIndex].x;
  const collected = [lines[startIndex].text];
  let chars = collected[0].length;
  for (let i = startIndex + 1; i < lines.length && collected.length < MAX_LINES && chars < MAX_CHARS; i++) {
    const line = lines[i];
    if (Math.abs(line.x - marginX) <= MARGIN_X_TOLERANCE) break;
    collected.push(line.text);
    chars += line.text.length;
  }

  void left; // kept for future use (column disambiguation); not needed by the current heuristic
  return { pageNumber, text: collected.join(" ").replace(/\s+/g, " ").trim() };
}

/**
 * Resolves an internal PDF link (figure/table/section/citation) to something the reader can
 * act on: a full bibliography entry to show inline, or — for everything else, including
 * citation styles the line-based extraction can't parse — a page to jump to.
 */
export async function resolveLinkTarget(doc: PDFDocumentProxy, dest: string | unknown[]): Promise<LinkTarget | null> {
  const resolved = await resolveDestination(doc, dest);
  if (!resolved) return null;
  const { pageNumber, left, top } = resolved;
  if (top === null) return { type: "jump", pageNumber };

  const entry = await extractReferenceEntry(doc, pageNumber, left, top);
  if (!entry) return { type: "jump", pageNumber };

  const startMatch = entry.text.match(START_MARKER);
  if (!startMatch) return { type: "jump", pageNumber };
  const rest = entry.text.slice(startMatch[0].length);
  if (EMBEDDED_MARKER.test(rest)) return { type: "jump", pageNumber };

  return { type: "citation", pageNumber, text: entry.text };
}
