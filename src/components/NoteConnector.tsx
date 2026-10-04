import { useEffect, useRef } from "react";
import type { Paragraph } from "../types";
import { paragraphAnchors } from "../lib/paragraphs.ts";

interface Props {
  paragraph: Paragraph;
  pdfPane: HTMLElement | null;
  notesPane: HTMLElement | null;
  variant: "active" | "hover";
}

/**
 * Draws the line from a comment to its paragraph across the two independently scrolling
 * panes. Redraw on scroll or layout changes, without a permanent animation loop.
 */
export default function NoteConnector({ paragraph, pdfPane, notesPane, variant }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const bracketRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!pdfPane || !notesPane) return;
    let raf = 0;
    const hide = () => {
      pathRef.current?.setAttribute("d", "");
      bracketRef.current?.setAttribute("d", "");
    };
    function draw() {
      const note = document.getElementById(`note-${paragraph.id}`);
      const pdfBox = pdfPane!.getBoundingClientRect();
      const anchors = paragraphAnchors(paragraph);
      const anchor =
        anchors.find((a) => {
          const box = document.getElementById(`page-${a.page + 1}`)?.getBoundingClientRect();
          return (
            box &&
            box.top + Math.max(...a.rects.map((r) => r[3])) * box.height > pdfBox.top &&
            box.top + Math.min(...a.rects.map((r) => r[1])) * box.height < pdfBox.bottom
          );
        }) ?? anchors[0];
      const page = document.getElementById(`page-${anchor.page + 1}`);
      if (!note || !page || !pdfPane || !notesPane) return hide();
      const notesBox = notesPane.getBoundingClientRect();
      const pageBox = page.getBoundingClientRect();
      const noteBox = note.getBoundingClientRect();

      const top = pageBox.top + Math.min(...anchor.rects.map((r) => r[1])) * pageBox.height;
      const bottom = pageBox.top + Math.max(...anchor.rects.map((r) => r[3])) * pageBox.height;
      const noteY = noteBox.top + 14;
      const paragraphVisible = bottom > pdfBox.top && top < pdfBox.bottom;
      const noteVisible = noteY > notesBox.top && noteY < notesBox.bottom;
      if (!paragraphVisible || !noteVisible) return hide();

      // The bracket sits just right of the page (or at the pane's edge when zoomed wider than it).
      const bx = Math.min(pageBox.right + 7, pdfBox.right - 4);
      const bTop = Math.max(top, pdfBox.top + 2);
      const bBottom = Math.min(bottom, pdfBox.bottom - 2);
      const midY = (bTop + bBottom) / 2;
      const nx = noteBox.left;
      bracketRef.current?.setAttribute("d", `M ${bx - 4} ${bTop} H ${bx} V ${bBottom} H ${bx - 4}`);
      const c = Math.max(24, (nx - bx) / 2);
      pathRef.current?.setAttribute(
        "d",
        `M ${bx} ${midY} C ${bx + c} ${midY}, ${nx - c} ${noteY}, ${nx} ${noteY}`,
      );
    }
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    pdfPane.addEventListener("scroll", schedule, { passive: true });
    notesPane.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(pdfPane);
    observer.observe(notesPane);
    const note = document.getElementById(`note-${paragraph.id}`);
    if (note) observer.observe(note);
    for (const a of paragraphAnchors(paragraph)) {
      const page = document.getElementById(`page-${a.page + 1}`);
      if (page) observer.observe(page);
    }
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      pdfPane.removeEventListener("scroll", schedule);
      notesPane.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [paragraph, pdfPane, notesPane]);

  return (
    <svg className={`note-connector note-connector-${variant}`} aria-hidden="true">
      <path ref={bracketRef} />
      <path ref={pathRef} />
    </svg>
  );
}
