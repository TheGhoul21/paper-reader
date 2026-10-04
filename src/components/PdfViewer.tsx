import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNarrow } from "../lib/useNarrow";
import PageCanvas from "./PageCanvas";
import NotesPane from "./NotesPane";
import TldrStrip, { pickTldr } from "./TldrStrip";
import NoteConnector from "./NoteConnector";
import CitationPopover from "./CitationPopover";
import ConceptPopover from "./ConceptPopover";
import ConceptHighlightBar from "./ConceptHighlightBar";
import { buildConceptMatcher } from "../lib/concepts";
import { cardId, useReview } from "../lib/review";
import { indexStructure } from "../lib/structure";
import { paragraphAnchors, paragraphsByPage } from "../lib/paragraphs.ts";
import Toolbar from "./Toolbar";
import { usePdfDocument } from "../lib/usePdfDocument";
import { usePdfViewport } from "../lib/usePdfViewport";
import { usePdfSearch } from "../lib/usePdfSearch";
import { useConceptHighlight } from "../lib/useConceptHighlight";
import { useReaderSession, type NotesTab } from "../lib/readerSession";
import { scrollToParagraph, waitForElement } from "../lib/pdfNavigation";
import { useReaderPreferences } from "../lib/readingProgress";
import type {
  Annotation,
  AnnotationTool,
  Concept,
  ConceptsIndex,
  Paragraph,
  PaperStructure,
  Tldr,
  Variant,
} from "../types";

interface Props {
  readerNavigation?: ReactNode;
  title: string;
  authors: string[];
  pdfUrl: string;
  paragraphs: Paragraph[];
  concepts: Concept[];
  /** Library-wide concept index, for "also in other papers" links. */
  conceptsIndex: ConceptsIndex;
  /** The paper's argument map, if it has one. */
  structure: PaperStructure | null;
  /** Plain-language summary per language, if the paper has one. */
  tldr?: Record<string, Tldr>;
  slug: string;
  /** Paragraph to open on load (the reader's `?p=` link, e.g. from another paper's glossary). */
  initialParagraphId: string | null;
  initialPage?: number;
  onProgress?: (progress: { page: number; paragraphId: string | null; variant: string }) => void;
  variants: Variant[];
  variant: string;
  onVariantChange: (key: string) => void;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
}

export default function PdfViewer({
  readerNavigation,
  title,
  authors,
  pdfUrl,
  paragraphs,
  concepts,
  conceptsIndex,
  structure,
  tldr,
  slug,
  initialParagraphId,
  initialPage,
  onProgress,
  variants,
  variant,
  onVariantChange,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: Props) {
  const narrow = useNarrow();
  const [session, dispatch] = useReaderSession(!narrow);
  const { activeId, notesOpen, tab: notesTab, threadOnly, focusClaim, previousId } = session;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [citation, setCitation] = useState<{
    text: string;
    pageNumber: number;
    anchor: { x: number; y: number };
  } | null>(null);
  const [openConcept, setOpenConcept] = useState<{
    id: string;
    fromParagraphId: string | null;
    anchor: { x: number; y: number };
  } | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("none");
  const [color, setColor] = useState("#e8916a");
  const [pdfPane, setPdfPane] = useState<HTMLDivElement | null>(null);
  const [notesPane, setNotesPane] = useState<HTMLElement | null>(null);
  const { doc, nativeSize, error, retry } = usePdfDocument(pdfUrl);
  const viewport = usePdfViewport(doc, nativeSize, pdfPane);
  const { scale, currentPage } = viewport;
  const search = usePdfSearch(doc);
  const preferences = useReaderPreferences();

  const byPage = useMemo(() => paragraphsByPage(paragraphs), [paragraphs]);

  // Global paragraph numbers (reading order across the paper), shown as matching badges on the
  // PDF and on each comment; and which paragraphs start a new section (those comments show its name).
  const { numbers, sectionStarts } = useMemo(() => {
    const ordered = [...paragraphs].sort((a, b) => a.page - b.page || a.order - b.order);
    const numbers = new Map<string, number>();
    const sectionStarts = new Set<string>();
    let prevSection: string | undefined;
    ordered.forEach((p, i) => {
      numbers.set(p.id, i + 1);
      if (p.section && p.section !== prevSection) sectionStarts.add(p.id);
      prevSection = p.section;
    });
    return { numbers, sectionStarts };
  }, [paragraphs]);

  const conceptMatcher = useMemo(() => buildConceptMatcher(concepts), [concepts]);

  // Argument map: "Il filo" marks its passages and filters comments; focus selects one claim.
  const summary = pickTldr(tldr, variants.find((v) => v.key === variant)?.language);
  const structureIndex = useMemo(
    () => indexStructure(structure, paragraphs),
    [structure, paragraphs],
  );
  const focusSet = useMemo(
    () =>
      focusClaim && structureIndex
        ? new Set(structureIndex.paragraphsOf.get(focusClaim) ?? [])
        : null,
    [focusClaim, structureIndex],
  );
  const threadSet = threadOnly && structureIndex ? structureIndex.thread : null;

  // Focusing a claim brings its first paragraph into view in the PDF.
  function handleFocusClaim(claimId: string | null) {
    dispatch({ type: "focus-claim", id: claimId });
    const first = claimId ? structureIndex?.paragraphsOf.get(claimId)?.[0] : undefined;
    const paragraph = first ? paragraphs.find((p) => p.id === first) : undefined;
    if (paragraph) scrollToParagraph(pdfPane, paragraph);
  }

  function handleNotesTab(tab: NotesTab) {
    dispatch({ type: "tab", tab });
    setHoverId(null);
  }
  useEffect(() => {
    if (!notesPane || !notesOpen) return;
    const controller = new AbortController();
    if (notesTab === "notes" && activeId) {
      void waitForElement(
        notesPane,
        () => document.getElementById(`note-${activeId}`),
        controller.signal,
      ).then((target) => {
        if (!controller.signal.aborted)
          target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    } else notesPane.scrollTo({ top: 0 });
    return () => controller.abort();
  }, [activeId, notesTab, notesPane, notesOpen, threadOnly]);

  // Review deck (library-wide, localStorage): notes and glossary cards can be added from here.
  // A paragraph with recall questions is reviewed through them; otherwise as "explain paragraph N".
  const { cards: reviewCards, addCard, addCards, removeCard, removeCards } = useReview();
  const paragraphCards = (paragraphId: string) => {
    const paragraph = paragraphs.find((p) => p.id === paragraphId);
    return paragraph?.recall?.length
      ? paragraph.recall.map((r) => ({
          kind: "question" as const,
          refId: `${paragraphId}#${r.id}`,
        }))
      : [{ kind: "paragraph" as const, refId: paragraphId }];
  };
  const inReview = (kind: "concept" | "paragraph", refId: string) =>
    kind === "concept"
      ? Boolean(reviewCards[cardId(slug, "concept", refId)])
      : paragraphCards(refId).some((c) => reviewCards[cardId(slug, c.kind, c.refId)]);
  const toggleReview = (kind: "concept" | "paragraph", refId: string) => {
    if (kind === "concept") {
      const id = cardId(slug, "concept", refId);
      if (reviewCards[id]) removeCard(id);
      else addCard(slug, "concept", refId, variant);
      return;
    }
    const items = paragraphCards(refId);
    if (inReview("paragraph", refId)) removeCards(items.map((c) => cardId(slug, c.kind, c.refId)));
    else addCards(items.map((c) => ({ ...c, slug, variant })));
  };
  // All of this paper's recall questions, for the "add them all" action in the notes pane.
  const allQuestions = useMemo(
    () =>
      paragraphs.flatMap((p) =>
        (p.recall ?? []).map((r) => ({ kind: "question" as const, refId: `${p.id}#${r.id}` })),
      ),
    [paragraphs],
  );
  const questionsInDeck = allQuestions.filter(
    (c) => reviewCards[cardId(slug, c.kind, c.refId)],
  ).length;

  const conceptsView = useConceptHighlight(doc, pdfPane, conceptMatcher);
  const { highlight, concept: highlightConcept } = conceptsView;

  function revealParagraph(paragraph: Paragraph, scrollPdf: boolean) {
    setCitation(null);
    dispatch({
      type: "reveal",
      id: paragraph.id,
      inThread: structureIndex?.thread.has(paragraph.id) ?? false,
    });
    if (scrollPdf) scrollToParagraph(pdfPane, paragraph);
  }
  const handleSelectParagraph = (paragraph: Paragraph) => revealParagraph(paragraph, false);
  const handleActivateNote = (paragraph: Paragraph) => revealParagraph(paragraph, true);
  const handleGoToParagraph = handleActivateNote;
  const initialJumpDone = useRef<string | null>(null);
  useEffect(() => {
    const destination = initialParagraphId ?? `page:${initialPage ?? 1}`;
    if (!pdfPane || !nativeSize || initialJumpDone.current === destination) return;
    // PageCanvas has actual placeholder dimensions at this point; no fixed rendering delay.
    initialJumpDone.current = destination;
    const paragraph = paragraphs.find((p) => p.id === initialParagraphId);
    if (paragraph) {
      dispatch({
        type: "reveal",
        id: paragraph.id,
        inThread: structureIndex?.thread.has(paragraph.id) ?? false,
      });
      scrollToParagraph(pdfPane, paragraph);
    } else viewport.jumpToPage(initialPage ?? 1);
  }, [
    pdfPane,
    nativeSize,
    initialParagraphId,
    paragraphs,
    initialPage,
    structureIndex,
    viewport,
    dispatch,
  ]);
  useEffect(() => {
    if (!initialJumpDone.current || !doc) return;
    const timer = setTimeout(() => {
      const active = paragraphs.find((p) => p.id === activeId);
      const paragraphId =
        active && paragraphAnchors(active).some((anchor) => anchor.page === currentPage - 1)
          ? activeId
          : null;
      onProgress?.({ page: currentPage, paragraphId, variant });
    }, 1000);
    return () => clearTimeout(timer);
  }, [doc, currentPage, activeId, variant, onProgress, paragraphs]);

  const annotationsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const list = map.get(a.page) ?? [];
      list.push(a);
      map.set(a.page, list);
    }
    return map;
  }, [annotations]);

  const connectorParagraphs = useMemo(() => {
    const byId = (id: string | null) => (id ? (paragraphs.find((p) => p.id === id) ?? null) : null);
    return { active: byId(activeId), hover: hoverId !== activeId ? byId(hoverId) : null };
  }, [paragraphs, activeId, hoverId]);

  function handleJumpToPage(page: number) {
    viewport.jumpToPage(page);
    setCitation(null);
  }
  if (error)
    return (
      <>
        {readerNavigation}
        <div className="state-message" role="alert">
          <p>Impossibile caricare il PDF: {error}</p>
          <button onClick={retry}>Riprova</button>
        </div>
      </>
    );
  if (!doc || !nativeSize)
    return (
      <>
        {readerNavigation}
        <p className="state-message" role="status">
          Caricamento PDF…
        </p>
      </>
    );

  return (
    <div
      className="pdf-viewer-wrapper"
      style={
        {
          "--reader-font-size": `${preferences.fontSize}px`,
          "--notes-width": `${preferences.panelWidth}px`,
        } as CSSProperties
      }
    >
      {readerNavigation}
      <Toolbar
        paper={{ title, authors, pdfUrl }}
        viewport={viewport}
        pageCount={doc.numPages}
        search={search}
        tools={{ tool, color, setTool, setColor }}
        variants={variants}
        variant={variant}
        onVariantChange={onVariantChange}
        panel={{ open: notesOpen, toggle: () => dispatch({ type: "toggle-panel" }) }}
        preferences={preferences}
        thread={
          structureIndex
            ? { on: threadOnly, onToggle: () => dispatch({ type: "toggle-thread" }) }
            : undefined
        }
        onBack={
          previousId
            ? () => {
                const p = paragraphs.find((p) => p.id === previousId);
                if (p) {
                  dispatch({ type: "back", inThread: structureIndex?.thread.has(p.id) ?? false });
                  scrollToParagraph(pdfPane, p);
                }
              }
            : undefined
        }
      />
      {summary && <TldrStrip tldr={summary} />}
      <div className="reader-body">
        {highlight && highlightConcept && (
          <ConceptHighlightBar
            term={highlightConcept.term}
            count={highlight.error ? 0 : (highlight.occurrences?.length ?? null)}
            error={highlight.error}
            index={highlight.index}
            onPrev={() => conceptsView.move(-1)}
            onNext={() => conceptsView.move(1)}
            onClose={conceptsView.close}
          />
        )}
        <div className="pdf-viewer" ref={setPdfPane}>
          {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((pageNumber) => (
            <PageCanvas
              key={pageNumber}
              doc={doc}
              pageNumber={pageNumber}
              scale={scale}
              defaultSize={nativeSize}
              paragraphs={byPage.get(pageNumber - 1) ?? []}
              numbers={numbers}
              activeId={activeId}
              hoverId={hoverId}
              onSelect={handleSelectParagraph}
              onHoverParagraph={setHoverId}
              onJumpToPage={handleJumpToPage}
              onCitation={(text, pageNumber, clientPos) => {
                setCitation({ text, pageNumber, anchor: clientPos });
              }}
              thread={threadSet}
              focus={focusSet}
              tool={tool}
              color={color}
              annotations={annotationsByPage.get(pageNumber - 1) ?? []}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
            />
          ))}
        </div>
        {(notesOpen || narrow) && (
          <NotesPane
            ref={setNotesPane}
            paperTitle={title}
            paragraphs={paragraphs}
            numbers={numbers}
            sectionStarts={sectionStarts}
            variant={variant}
            activeId={activeId}
            hoverId={hoverId}
            conceptMatcher={conceptMatcher}
            argument={
              structure && structureIndex
                ? {
                    structure,
                    index: structureIndex,
                    tab: notesTab,
                    onTab: handleNotesTab,
                    threadOnly,
                    onToggleThread: () => dispatch({ type: "toggle-thread" }),
                    focusClaim,
                    onFocusClaim: (id) => {
                      handleFocusClaim(id);
                    },
                    onGoToParagraph: (id) => {
                      const paragraph = paragraphs.find((p) => p.id === id);
                      if (paragraph) handleGoToParagraph(paragraph);
                    },
                  }
                : undefined
            }
            isInReview={(id) => inReview("paragraph", id)}
            recallSummary={
              allQuestions.length > 0
                ? {
                    total: allQuestions.length,
                    inDeck: questionsInDeck,
                    reviewUrl: `/review?paper=${slug}`,
                    onAddAll: () => addCards(allQuestions.map((c) => ({ ...c, slug, variant }))),
                  }
                : undefined
            }
            onToggleReview={(id) => toggleReview("paragraph", id)}
            onActivate={handleActivateNote}
            onConcept={(id, fromParagraphId, anchor) => {
              setCitation(null);
              setOpenConcept({ id, fromParagraphId, anchor });
            }}
            onHover={setHoverId}
            onJumpToPage={handleJumpToPage}
            onGoToParagraph={(id) => {
              const paragraph = paragraphs.find((p) => p.id === id);
              if (paragraph) handleGoToParagraph(paragraph);
            }}
            sheet={
              narrow
                ? { expanded: notesOpen, onToggle: () => dispatch({ type: "toggle-panel" }) }
                : undefined
            }
          />
        )}
      </div>
      {notesOpen && !narrow && connectorParagraphs.hover && (
        <NoteConnector
          paragraph={connectorParagraphs.hover}
          pdfPane={pdfPane}
          notesPane={notesPane}
          variant="hover"
        />
      )}
      {notesOpen && !narrow && connectorParagraphs.active && (
        <NoteConnector
          paragraph={connectorParagraphs.active}
          pdfPane={pdfPane}
          notesPane={notesPane}
          variant="active"
        />
      )}
      {citation && (
        <CitationPopover
          text={citation.text}
          pageNumber={citation.pageNumber}
          sourceSlug={slug}
          variant={variants.find((v) => v.key === variant)}
          anchor={citation.anchor}
          onJumpToPage={handleJumpToPage}
          onClose={() => setCitation(null)}
        />
      )}
      {openConcept &&
        conceptMatcher.byId.has(openConcept.id) &&
        (() => {
          const concept = conceptMatcher.byId.get(openConcept.id)!;
          const definedIn = paragraphs.find((p) => p.id === concept.definedIn) ?? null;
          return (
            <ConceptPopover
              concept={concept}
              variant={variant}
              definedIn={definedIn}
              definedInNumber={definedIn ? numbers.get(definedIn.id) : undefined}
              fromParagraphId={openConcept.fromParagraphId}
              related={concept.related.flatMap((id) => conceptMatcher.byId.get(id) ?? [])}
              elsewhere={(conceptsIndex[concept.id] ?? []).filter((e) => e.slug !== slug)}
              anchor={openConcept.anchor}
              onGoToParagraph={handleGoToParagraph}
              onSelectConcept={(id) => setOpenConcept((c) => (c ? { ...c, id } : c))}
              onHighlight={() => conceptsView.open(concept.id)}
              inReview={inReview("concept", concept.id)}
              onToggleReview={() => toggleReview("concept", concept.id)}
              onClose={() => setOpenConcept(null)}
            />
          );
        })()}
    </div>
  );
}
