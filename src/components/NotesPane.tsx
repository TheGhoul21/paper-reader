import { forwardRef, useMemo, useId, useState } from "react";
import { Link } from "react-router-dom";
import ExplanationNote from "./ExplanationNote";
import ArgumentMap from "./ArgumentMap";
import ReadingGuide from "./ReadingGuide";
import { indexReadingGuide } from "../lib/readingGuide";
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
    tab: "notes" | "map" | "guide";
    onTab: (tab: "notes" | "map" | "guide") => void;
    threadOnly: boolean;
    onToggleThread: () => void;
    focusClaim: string | null;
    onFocusClaim: (claimId: string | null) => void;
    onGoToParagraph: (paragraphId: string) => void;
  };
  isInReview: (paragraphId: string) => boolean;
  /** Present when the paper has recall questions: how many, how many are in the deck, and actions. */
  recallSummary?: { total: number; inDeck: number; reviewUrl: string; onAddAll: () => void };
  onToggleReview: (paragraphId: string) => void;
  onActivate: (paragraph: Paragraph) => void;
  onConcept: (
    conceptId: string,
    fromParagraphId: string,
    clientPos: { x: number; y: number },
  ) => void;
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
  {
    paperTitle,
    paragraphs,
    numbers,
    sectionStarts,
    variant,
    activeId,
    hoverId,
    conceptMatcher,
    argument,
    isInReview,
    recallSummary,
    onToggleReview,
    onActivate,
    onConcept,
    onHover,
    onJumpToPage,
    onGoToParagraph,
    sheet,
  },
  ref,
) {
  const tabId = useId();
  const [fullSheet, setFullSheet] = useState(false);
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
  const guides = argument?.structure.readingGuide;
  const showGuide = argument?.tab === "guide" && Boolean(guides?.length);
  const showNotes = !showMap && !showGuide;
  const readingContexts = useMemo(() => indexReadingGuide(guides), [guides]);
  const byId = useMemo(() => new Map(paragraphs.map((p) => [p.id, p])), [paragraphs]);

  return (
    <aside
      ref={ref}
      className={`notes-pane${sheet ? " is-sheet" : ""}${sheet && !sheet.expanded ? " is-collapsed" : ""}${sheet && fullSheet ? " is-full" : ""}`}
      aria-label="Spiegazioni"
    >
      {sheet && (
        <div className="notes-sheet-header">
          <button
            className="notes-sheet-bar"
            onClick={sheet.onToggle}
            aria-expanded={sheet.expanded}
            aria-controls={`${tabId}-contents`}
          >
            <span className="notes-sheet-handle" />
            <span>
              {sheet.expanded
                ? argument
                  ? guides?.length
                    ? "Spiegazioni, mappa e guida"
                    : "Spiegazioni e mappa"
                  : "Spiegazioni"
                : activeId
                  ? `Spiegazione ${numbers.get(activeId)} · tocca per aprire`
                  : "Spiegazioni · tocca un paragrafo del PDF"}
            </span>
            <span className="notes-sheet-chevron">{sheet.expanded ? "▾" : "▴"}</span>
          </button>
          {sheet.expanded && (
            <button
              className="notes-sheet-size"
              aria-pressed={fullSheet}
              aria-label={
                fullSheet ? "Riduci pannello spiegazioni" : "Espandi pannello spiegazioni"
              }
              onClick={() => setFullSheet((full) => !full)}
            >
              {fullSheet ? "Riduci" : "Espandi"}
            </button>
          )}
        </div>
      )}
      <div id={`${tabId}-contents`} hidden={Boolean(sheet && !sheet.expanded)}>
        {argument && (
          <div
            className="notes-tabs"
            role="tablist"
            tabIndex={-1}
            aria-label="Contenuti del paper"
            onKeyDown={(e) => {
              const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")];
              const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
              let next = index;
              if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = tabs.length - 1;
              else return;
              e.preventDefault();
              tabs[next].focus();
              tabs[next].click();
            }}
          >
            {(
              [
                { key: "notes", label: "Spiegazioni", active: showNotes },
                { key: "map", label: "Mappa", active: showMap },
                ...(guides?.length ? [{ key: "guide", label: "Guida", active: showGuide }] : []),
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                id={`${tabId}-${tab.key}`}
                role="tab"
                tabIndex={tab.active ? 0 : -1}
                aria-selected={tab.active}
                aria-controls={`${tabId}-panel`}
                className={`notes-tab${tab.active ? " is-active" : ""}`}
                onClick={() => argument.onTab(tab.key as "notes" | "map" | "guide")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {thread && (
          <div className="notes-thread-hint">
            <span>
              Solo il filo: {thread.size} di {paragraphs.length} passaggi
            </span>
            <button onClick={argument?.onToggleThread}>Mostra tutti</button>
          </div>
        )}
        <div
          id={`${tabId}-panel`}
          role={argument ? "tabpanel" : undefined}
          aria-labelledby={
            argument ? `${tabId}-${showMap ? "map" : showGuide ? "guide" : "notes"}` : undefined
          }
        >
          {showGuide && guides && (
            <ReadingGuide
              sections={guides}
              variant={variant}
              activeId={activeId}
              numbers={numbers}
              onGoToParagraph={onGoToParagraph}
            />
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
          {showNotes && recallSummary && (
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
          {showNotes &&
            pages.map(([page, list]) => (
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
                    readingContext={readingContexts.get(p.id)}
                    onOpenGuide={argument ? () => argument.onTab("guide") : undefined}
                    leadsTo={p.leadsTo?.flatMap((link) => {
                      const target = byId.get(link.to);
                      return target
                        ? [{ target, number: numbers.get(target.id) ?? 0, why: link.why }]
                        : [];
                    })}
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
        </div>
      </div>
    </aside>
  );
});

export default NotesPane;
