import { paragraphAnchors } from "./paragraphs.ts";
import type { Paragraph } from "../types";

/** DOM conventions for the PDF surface live here, including readiness and cancellation. */
export function waitForElement(
  root: HTMLElement,
  find: () => HTMLElement | null,
  signal?: AbortSignal,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }
    const present = find();
    if (present) {
      resolve(present);
      return;
    }
    const finish = (value: HTMLElement | null) => {
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      const target = find();
      if (target) finish(target);
    });
    const abort = () => finish(null);
    const timer = setTimeout(() => finish(null), 5000);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function scrollToParagraph(pane: HTMLElement | null, paragraph: Paragraph) {
  if (!pane) return;
  const anchor = paragraphAnchors(paragraph)[0];
  const page = pane.querySelector<HTMLElement>(`#page-${anchor.page + 1}`);
  if (!page) return;
  const paneBox = pane.getBoundingClientRect();
  const pageBox = page.getBoundingClientRect();
  const top = pageBox.top + Math.min(...anchor.rects.map((r) => r[1])) * pageBox.height;
  const bottom = pageBox.top + Math.max(...anchor.rects.map((r) => r[3])) * pageBox.height;
  if (top >= paneBox.top && bottom <= paneBox.bottom) return;
  pane.scrollBy({ top: top - paneBox.top - paneBox.height * 0.25, behavior: "smooth" });
}
