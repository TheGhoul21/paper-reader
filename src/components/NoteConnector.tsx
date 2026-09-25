import { useEffect, useRef } from "react";
import type { Paragraph } from "../types";

interface Props {
  paragraph: Paragraph;
  pdfPane: HTMLElement | null;
  notesPane: HTMLElement | null;
  variant: "active" | "hover";
}

/**
 * Draws the line from a comment to its paragraph across the two independently scrolling
 * panes: a bracket in the page's right margin spanning the paragraph, and a curve from
 * there to the comment. Positions are read from the DOM every frame (both panes scroll,
 * zoom changes page sizes) and written straight to the SVG, bypassing React.
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
      raf = requestAnimationFrame(draw);
      const note = document.getElementById(`note-${paragraph.id}`);
      const page = document.getElementById(`page-${paragraph.page + 1}`);
      if (!note || !page || !pdfPane || !notesPane) return hide();
      const pdfBox = pdfPane.getBoundingClientRect();
      const notesBox = notesPane.getBoundingClientRect();
      const pageBox = page.getBoundingClientRect();
      const noteBox = note.getBoundingClientRect();

      const top = pageBox.top + Math.min(...paragraph.rects.map((r) => r[1])) * pageBox.height;
      const bottom = pageBox.top + Math.max(...paragraph.rects.map((r) => r[3])) * pageBox.height;
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
      pathRef.current?.setAttribute("d", `M ${bx} ${midY} C ${bx + c} ${midY}, ${nx - c} ${noteY}, ${nx} ${noteY}`);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [paragraph, pdfPane, notesPane]);

  return (
    <svg className={`note-connector note-connector-${variant}`} aria-hidden="true">
      <path ref={bracketRef} />
      <path ref={pathRef} />
    </svg>
  );
}
