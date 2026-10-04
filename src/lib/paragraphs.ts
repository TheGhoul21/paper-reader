import type { Paragraph, ParagraphAnchor } from "../types";

/** Existing IDs and page/rects remain readable; new passages may span several pages. */
export function paragraphAnchors(paragraph: Paragraph): ParagraphAnchor[] {
  return paragraph.anchors ?? [{ page: paragraph.page, rects: paragraph.rects }];
}

/** One hit area per page, retaining the logical passage's identity and explanation. */
export function paragraphsByPage(paragraphs: Paragraph[]): Map<number, Paragraph[]> {
  const pages = new Map<number, Paragraph[]>();
  for (const paragraph of paragraphs) {
    const rects = new Map<number, Paragraph["rects"]>();
    for (const anchor of paragraphAnchors(paragraph)) {
      rects.set(anchor.page, [...(rects.get(anchor.page) ?? []), ...anchor.rects]);
    }
    for (const [page, boxes] of rects) {
      const list = pages.get(page) ?? [];
      list.push({ ...paragraph, page, rects: boxes });
      pages.set(page, list);
    }
  }
  return pages;
}
