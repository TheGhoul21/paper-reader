import { forwardRef, useMemo } from "react";
import { Link } from "react-router-dom";
import ExplanationNote from "./ExplanationNote";
import ArgumentMap from "./ArgumentMap";
import type { StructureIndex } from "../lib/structure";
import type { ConceptMatcher } from "../lib/concepts";
import type { Paragraph, PaperStructure } from "../types";

interface Props {
  paperTitle: string;
  paragraphs: Paragraph[];
  numbers: Map<string, number>;
  sectionStarts: Set<string>;
  variant: string;
  activeId: string | null;
  hoverId: string | null;
  conceptMatcher: ConceptMatcher;
  /** Present when the paper has an argument map: adds the "Mappa" tab, role chips, and the thread filter. */
  argument?: {
    structure: PaperStructure;
    index: StructureIndex;
    tab: "notes" | "map";
    onTab: (tab: "notes" | "map") => void;
    threadOnly: boolean;
    focusClaim: string | null;
    onFocusClaim: (claimId: string | null) => void;
    onGoToParagraph: (paragraphId: string) => void;
  };
  isInReview: (paragraphId: string) => boolean;
  /** Present when the paper has recall questions: how many, how many are in the deck, and actions. */
  recallSummary?: { total: number; inDeck: number; reviewUrl: string; onAddAll: () => void };
  onToggleReview: (paragraphId: string) => void;
  onActivate: (paragraph: Paragraph) => void;
  onConcept: (conceptId: string, fromParagraphId: string, clientPos: { x: number; y: number }) => void;
  onHover: (id: string | null) => void;
  onJumpToPage: (page: number) => void;
  onGoToParagraph: (paragraphId: string) => void;
  /** Narrow screens: the pane is a bottom sheet that collapses to a bar. */
  sheet?: { expanded: boolean; onToggle: () => void };
}

/**
 * The comments column: every explanation in reading order, grouped by page, in its own
 * scroll container independent of the PDF's (they're linked by numbers, hover highlighting,
 * click-to-reveal and the connector line, not by scroll position).
 */
const NotesPane = forwardRef<HTMLElement, Props>(function NotesPane(
  { paperTitle, paragraphs, numbers, sectionStarts, variant, activeId, hoverId, conceptMatcher, argument, isInReview, recallSummary, onToggleReview, onActivate, onConcept, onHover, onJumpToPage, onGoToParagraph, sheet },
  ref,
) {
  const thread = argument?.threadOnly ? argument.index.thread : null;
  const pages = useMemo(() => {
    const byPage = new Map<number, Paragraph[]>();
    for (const p of [...paragraphs].sort((a, b) => a.page - b.page || a.order - b.order)) {
      if (thread && !thread.has(p.id)) continue;
      const list = byPage.get(p.page) ?? [];
      list.push(p);
      byPage.set(p.page, list);
    }
    return [...byPage.entries()];
  }, [paragraphs, thread]);
  const showMap = argument?.tab === "map";

  return (
    <aside
      ref={ref}
      className={`notes-pane${sheet ? " is-sheet" : ""}${sheet && !sheet.expanded ? " is-collapsed" : ""}`}
      aria-label="Commenti"
    >
      {sheet && (
        <button className="notes-sheet-bar" onClick={sheet.onToggle} aria-expanded={sheet.expanded}>
          <span className="notes-sheet-handle" />
          <span>
            {sheet.expanded
              ? argument
                ? "Commenti e mappa"
                : "Commenti"
              : activeId
                ? `Commento ${numbers.get(activeId)} · tocca per aprire`
                : "Commenti · tocca un paragrafo del PDF"}
          </span>
          <span className="notes-sheet-chevron">{sheet.expanded ? "▾" : "▴"}</span>
        </button>
      )}
      {argument && (
        <div className="notes-tabs" role="tablist">
          <button role="tab" aria-selected={!showMap} className={`notes-tab${!showMap ? " is-active" : ""}`} onClick={() => argument.onTab("notes")}>
            Commenti
          </button>
          <button role="tab" aria-selected={showMap} className={`notes-tab${showMap ? " is-active" : ""}`} onClick={() => argument.onTab("map")}>
            Mappa
          </button>
        </div>
      )}
      {showMap && argument && (
        <ArgumentMap
          structure={argument.structure}
          index={argument.index}
          variant={variant}
          numbers={numbers}
          focusClaim={argument.focusClaim}
          onFocusClaim={argument.onFocusClaim}
          onGoToParagraph={argument.onGoToParagraph}
        />
      )}
      {!showMap && thread && <p className="notes-thread-hint">Il filo: {thread.size} paragrafi su {paragraphs.length} — solo quelli che enunciano o provano le tesi del paper.</p>}
      {!showMap && recallSummary && (
        <div className="recall-summary">
          <span>
            <strong>{recallSummary.total}</strong> domande di ripasso
            {recallSummary.inDeck > 0 && <> · {recallSummary.inDeck} nel ripasso</>}
          </span>
          {recallSummary.inDeck < recallSummary.total ? (
            <button className="explanation-ask-btn" onClick={recallSummary.onAddAll}>
              Aggiungile tutte
            </button>
          ) : (
            <Link className="explanation-ask-btn" to={recallSummary.reviewUrl}>
              Ripassa questo paper →
            </Link>
          )}
        </div>
      )}
      {!showMap && pages.map(([page, list]) => (
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
              conceptMatcher={conceptMatcher}
              roles={argument?.index.roles.get(p.id)}
              onRoleClick={argument ? (claimId) => argument.onFocusClaim(claimId) : undefined}
              inReview={isInReview(p.id)}
              onToggleReview={() => onToggleReview(p.id)}
              onActivate={() => onActivate(p)}
              onConcept={(conceptId, pos) => onConcept(conceptId, p.id, pos)}
              onHover={(h) => onHover(h ? p.id : null)}
              onGoToParagraph={onGoToParagraph}
            />
          ))}
        </section>
      ))}
    </aside>
  );
});

export default NotesPane;
