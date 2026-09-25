import { forwardRef, useMemo } from "react";
import ExplanationNote from "./ExplanationNote";
import type { Paragraph } from "../types";

interface Props {
  paperTitle: string;
  paragraphs: Paragraph[];
  numbers: Map<string, number>;
  sectionStarts: Set<string>;
  variant: string;
  activeId: string | null;
  hoverId: string | null;
  onActivate: (paragraph: Paragraph) => void;
  onHover: (id: string | null) => void;
  onJumpToPage: (page: number) => void;
}

/**
 * The comments column: every explanation in reading order, grouped by page, in its own
 * scroll container independent of the PDF's (they're linked by numbers, hover highlighting,
 * click-to-reveal and the connector line, not by scroll position).
 */
const NotesPane = forwardRef<HTMLElement, Props>(function NotesPane(
  { paperTitle, paragraphs, numbers, sectionStarts, variant, activeId, hoverId, onActivate, onHover, onJumpToPage },
  ref,
) {
  const pages = useMemo(() => {
    const byPage = new Map<number, Paragraph[]>();
    for (const p of [...paragraphs].sort((a, b) => a.page - b.page || a.order - b.order)) {
      const list = byPage.get(p.page) ?? [];
      list.push(p);
      byPage.set(p.page, list);
    }
    return [...byPage.entries()];
  }, [paragraphs]);

  return (
    <aside ref={ref} className="notes-pane" aria-label="Commenti">
      {pages.map(([page, list]) => (
        <section key={page} className="notes-page">
          <button className="notes-page-label" onClick={() => onJumpToPage(page + 1)}>
            Pagina {page + 1}
          </button>
          {list.map((p) => (
            <ExplanationNote
              key={p.id}
              paperTitle={paperTitle}
              paragraph={p}
              number={numbers.get(p.id) ?? 0}
              showSection={sectionStarts.has(p.id)}
              variant={variant}
              active={p.id === activeId}
              highlighted={p.id === hoverId}
              onActivate={() => onActivate(p)}
              onHover={(h) => onHover(h ? p.id : null)}
            />
          ))}
        </section>
      ))}
    </aside>
  );
});

export default NotesPane;
