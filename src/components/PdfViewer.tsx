import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib } from "../lib/pdfjs";
import { findMatches, highlightMatchInDom, type SearchMatch } from "../lib/search";
import { useNarrow } from "../lib/useNarrow";
import PageCanvas from "./PageCanvas";
import NotesPane from "./NotesPane";
import TldrStrip, { pickTldr } from "./TldrStrip";
import NoteConnector from "./NoteConnector";
import CitationPopover from "./CitationPopover";
import ConceptPopover from "./ConceptPopover";
import ConceptHighlightBar from "./ConceptHighlightBar";
import { buildConceptMatcher, pdfSpellings, spellingPattern } from "../lib/concepts";
import { findOccurrences, markTextLayers, scrollToOccurrence, unmarkTextLayers, type Occurrence } from "../lib/conceptHighlight";
import { cardId, useReview } from "../lib/review";
import { indexStructure } from "../lib/structure";
import Toolbar, { type FitMode } from "./Toolbar";
import type { Annotation, AnnotationTool, Concept, ConceptsIndex, Paragraph, PaperStructure, Tldr, Variant } from "../types";

interface Props {
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
  variants: Variant[];
  variant: string;
  onVariantChange: (key: string) => void;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
}

const DEFAULT_SCALE = 1.5;
const MIN_SCALE = 0.75;
const MAX_SCALE = 5.25;
const HEADER_TOOLBAR_ALLOWANCE = 100; // rough space taken by the toolbar + margins, for "fit page" (no app header/heading above it anymore)
const TLDR_STRIP_HEIGHT = 35; // the "In breve" strip under the toolbar, when the paper has a summary

export default function PdfViewer({
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
  variants,
  variant,
  onVariantChange,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const narrow = useNarrow();
  // Desktop: the comments column is shown or hidden. Narrow screens: it's a bottom sheet,
  // always present, and this says whether it's expanded (it starts collapsed to a bar).
  const [notesOpen, setNotesOpen] = useState(!narrow);
  const [citation, setCitation] = useState<{ text: string; pageNumber: number; anchor: { x: number; y: number } } | null>(null);
  const [openConcept, setOpenConcept] = useState<{ id: string; fromParagraphId: string | null; anchor: { x: number; y: number } } | null>(
    null,
  );
  // The glossary concept currently highlighted in the PDF, with its occurrences (null while counting).
  const [highlight, setHighlight] = useState<{ conceptId: string; occurrences: Occurrence[] | null; index: number } | null>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  // A phone can't show a page at 100% — start fitted to the width there.
  const [fitMode, setFitMode] = useState<FitMode>(narrow ? "width" : "none");
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tool, setTool] = useState<AnnotationTool>("none");
  const [color, setColor] = useState("#e8916a");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  // The two independently scrolling panes. State (not refs) so NoteConnector re-runs once they mount.
  const [pdfPane, setPdfPane] = useState<HTMLDivElement | null>(null);
  const [notesPane, setNotesPane] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjsLib.getDocument(pdfUrl);
    task.promise.then(
      (loaded) => {
        if (!cancelled) setDoc(loaded);
      },
      (err) => {
        if (!cancelled) setError(String(err));
      },
    );
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!doc) return;
    doc.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      setNativeSize({ width: viewport.width, height: viewport.height });
    });
  }, [doc]);

  // Recompute fit-width / fit-page whenever the mode, native page size, or window size changes.
  useEffect(() => {
    if (fitMode === "none" || !nativeSize) return;
    function apply() {
      if (!nativeSize) return;
      const padding = pdfPane ? parseFloat(getComputedStyle(pdfPane).paddingLeft) * 2 : 32;
      const containerWidth = (pdfPane?.clientWidth ?? window.innerWidth) - padding;
      if (fitMode === "width") {
        setScale(containerWidth / nativeSize.width);
      } else {
        const availableHeight = window.innerHeight - HEADER_TOOLBAR_ALLOWANCE - (tldr ? TLDR_STRIP_HEIGHT : 0);
        setScale(Math.min(containerWidth / nativeSize.width, availableHeight / nativeSize.height));
      }
    }
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [fitMode, nativeSize, notesOpen, pdfPane, tldr]);

  useEffect(() => {
    if (!doc || !searchQuery.trim()) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      findMatches(doc, searchQuery).then((matches) => {
        if (cancelled) return;
        setSearchMatches(matches);
        setSearchIndex(0);
        if (matches.length > 0) highlightMatchInDom(matches[0], searchQuery);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, searchQuery]);

  const byPage = useMemo(() => {
    const map = new Map<number, Paragraph[]>();
    for (const p of paragraphs) {
      const list = map.get(p.page) ?? [];
      list.push(p);
      map.set(p.page, list);
    }
    return map;
  }, [paragraphs]);

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

  // Argument map: "Il filo" (dim everything off the thread) and the claim focused in the map.
  const summary = pickTldr(tldr, variants.find((v) => v.key === variant)?.language);
  const structureIndex = useMemo(() => indexStructure(structure, paragraphs), [structure, paragraphs]);
  const [threadOnly, setThreadOnly] = useState(false);
  const [focusClaim, setFocusClaim] = useState<string | null>(null);
  const [notesTab, setNotesTab] = useState<"notes" | "map">("notes");
  const focusSet = useMemo(
    () => (focusClaim && structureIndex ? new Set(structureIndex.paragraphsOf.get(focusClaim) ?? []) : null),
    [focusClaim, structureIndex],
  );
  const threadSet = threadOnly && structureIndex ? structureIndex.thread : null;

  // Focusing a claim brings its first paragraph into view in the PDF.
  function handleFocusClaim(claimId: string | null) {
    setFocusClaim(claimId);
    const first = claimId ? structureIndex?.paragraphsOf.get(claimId)?.[0] : undefined;
    const paragraph = first ? paragraphs.find((p) => p.id === first) : undefined;
    if (paragraph) scrollPdfToParagraph(paragraph);
  }

  // Review deck (library-wide, localStorage): notes and glossary cards can be added from here.
  // A paragraph with recall questions is reviewed through them; otherwise as "explain paragraph N".
  const { cards: reviewCards, addCard, addCards, removeCard, removeCards } = useReview();
  const paragraphCards = (paragraphId: string) => {
    const paragraph = paragraphs.find((p) => p.id === paragraphId);
    return paragraph?.recall?.length
      ? paragraph.recall.map((r) => ({ kind: "question" as const, refId: `${paragraphId}#${r.id}` }))
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
    () => paragraphs.flatMap((p) => (p.recall ?? []).map((r) => ({ kind: "question" as const, refId: `${p.id}#${r.id}` }))),
    [paragraphs],
  );
  const questionsInDeck = allQuestions.filter((c) => reviewCards[cardId(slug, c.kind, c.refId)]).length;

  const highlightConcept = highlight ? conceptMatcher.byId.get(highlight.conceptId) ?? null : null;
  const highlightPattern = useMemo(() => (highlightConcept ? spellingPattern(pdfSpellings(highlightConcept)) : null), [highlightConcept]);

  // Count the highlighted concept's occurrences over the whole document, then jump to the first.
  useEffect(() => {
    if (!doc || !highlightPattern) return;
    let cancelled = false;
    findOccurrences(doc, highlightPattern).then((occurrences) => {
      if (cancelled) return;
      setHighlight((h) => (h ? { ...h, occurrences, index: 0 } : h));
      if (occurrences.length > 0) scrollToOccurrence(occurrences[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, highlightPattern]);

  // Mark it in every text layer — including ones rendered later (lazy pages) or rebuilt (zoom).
  useEffect(() => {
    if (!pdfPane || !highlightPattern) return;
    const pane = pdfPane;
    let raf = 0;
    const apply = () => markTextLayers(pane, highlightPattern);
    apply();
    // Marking is idempotent, so the mutations it causes itself settle after one extra pass.
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    observer.observe(pane, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      unmarkTextLayers(pane);
    };
  }, [pdfPane, highlightPattern]);

  function goToOccurrence(delta: number) {
    if (!highlight?.occurrences?.length) return;
    const count = highlight.occurrences.length;
    const index = (highlight.index + delta + count) % count;
    setHighlight({ ...highlight, index });
    scrollToOccurrence(highlight.occurrences[index]);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveId(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSelectParagraph(paragraph: Paragraph) {
    setCitation(null);
    setActiveId(paragraph.id);
    setNotesOpen(true);
    // Wait for the (possibly just reopened) pane to lay out before scrolling its note into view.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById(`note-${paragraph.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      ),
    );
  }

  // Clicking a comment brings its paragraph into view in the PDF pane, unless it already is.
  function handleActivateNote(paragraph: Paragraph) {
    setActiveId(paragraph.id);
    scrollPdfToParagraph(paragraph);
  }

  function scrollPdfToParagraph(paragraph: Paragraph) {
    const page = document.getElementById(`page-${paragraph.page + 1}`);
    if (!pdfPane || !page) return;
    const paneBox = pdfPane.getBoundingClientRect();
    const pageBox = page.getBoundingClientRect();
    const top = pageBox.top + Math.min(...paragraph.rects.map((r) => r[1])) * pageBox.height;
    const bottom = pageBox.top + Math.max(...paragraph.rects.map((r) => r[3])) * pageBox.height;
    if (top >= paneBox.top && bottom <= paneBox.bottom) return;
    pdfPane.scrollBy({ top: top - paneBox.top - paneBox.height * 0.25, behavior: "smooth" });
  }

  // From the glossary: bring a paragraph into view in both panes and make it the active one.
  function handleGoToParagraph(paragraph: Paragraph) {
    setNotesOpen(true);
    setNotesTab("notes");
    handleActivateNote(paragraph);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById(`note-${paragraph.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      ),
    );
  }

  // A `?p=` link: once page sizes are known, bring that paragraph up. The short delay lets every
  // page placeholder take its real height first, so the scroll target doesn't move under us.
  const initialJumpDone = useRef(false);
  useEffect(() => {
    if (!doc || !nativeSize || !initialParagraphId || initialJumpDone.current) return;
    const paragraph = paragraphs.find((p) => p.id === initialParagraphId);
    if (!paragraph) return;
    initialJumpDone.current = true;
    const timer = setTimeout(() => handleGoToParagraph(paragraph), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, nativeSize, initialParagraphId, paragraphs]);

  const annotationsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const list = map.get(a.page) ?? [];
      list.push(a);
      map.set(a.page, list);
    }
    return map;
  }, [annotations]);

  // Track which page is "current" from scroll position: the last page whose top has
  // scrolled past a reference line just below the PDF pane's top edge. Pages are a simple
  // top-to-bottom DOM-ordered stack, so this is monotonic and doesn't need IntersectionObserver.
  useEffect(() => {
    if (!doc || !pdfPane) return;
    const pane = pdfPane;
    const numPages = doc.numPages;
    let raf = 0;
    function computeCurrentPage() {
      const referenceY = pane.getBoundingClientRect().top + 10;
      let best = 1;
      for (let n = 1; n <= numPages; n++) {
        const el = document.getElementById(`page-${n}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= referenceY) best = n;
        else break;
      }
      setCurrentPage((prev) => (prev !== best ? best : prev));
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeCurrentPage);
    }
    pane.addEventListener("scroll", onScroll, { passive: true });
    computeCurrentPage();
    return () => {
      pane.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
    // Re-run after zoom changes too: page positions shift without a scroll event firing.
  }, [doc, scale, pdfPane]);

  const connectorParagraphs = useMemo(() => {
    const byId = (id: string | null) => (id ? paragraphs.find((p) => p.id === id) ?? null : null);
    return { active: byId(activeId), hover: hoverId !== activeId ? byId(hoverId) : null };
  }, [paragraphs, activeId, hoverId]);

  function handleZoom(delta: number) {
    setFitMode("none");
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  }

  function handleJumpToPage(page: number) {
    if (!doc) return;
    const clamped = Math.min(doc.numPages, Math.max(1, page));
    document.getElementById(`page-${clamped}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(clamped);
    setCitation(null);
  }

  function goToMatch(index: number) {
    if (searchMatches.length === 0) return;
    const clamped = (index + searchMatches.length) % searchMatches.length;
    setSearchIndex(clamped);
    highlightMatchInDom(searchMatches[clamped], searchQuery);
  }

  if (error) return <p className="state-message">Could not load PDF: {error}</p>;
  if (!doc) return <p className="state-message">Loading PDF…</p>;

  return (
    <div className="pdf-viewer-wrapper">
      <Toolbar
        title={title}
        authors={authors}
        pdfUrl={pdfUrl}
        scale={scale}
        onZoom={handleZoom}
        fitMode={fitMode}
        onFit={setFitMode}
        currentPage={currentPage}
        numPages={doc.numPages}
        onJumpToPage={handleJumpToPage}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchMatchCount={searchMatches.length}
        searchMatchIndex={searchIndex}
        onSearchNext={() => goToMatch(searchIndex + 1)}
        onSearchPrev={() => goToMatch(searchIndex - 1)}
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        variants={variants}
        variant={variant}
        onVariantChange={onVariantChange}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen((o) => !o)}
        thread={structureIndex ? { on: threadOnly, onToggle: () => setThreadOnly((t) => !t) } : undefined}
      />
      {summary && <TldrStrip tldr={summary} />}
      <div className="reader-body">
        {highlight && highlightConcept && (
          <ConceptHighlightBar
            term={highlightConcept.term}
            count={highlight.occurrences?.length ?? null}
            index={highlight.index}
            onPrev={() => goToOccurrence(-1)}
            onNext={() => goToOccurrence(1)}
            onClose={() => setHighlight(null)}
          />
        )}
        <div className="pdf-viewer" ref={setPdfPane}>
          {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((pageNumber) => (
            <PageCanvas
              key={pageNumber}
              doc={doc}
              pageNumber={pageNumber}
              scale={scale}
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
                    onTab: setNotesTab,
                    threadOnly,
                    focusClaim,
                    onFocusClaim: (id) => {
                      handleFocusClaim(id);
                      if (id) setNotesTab("map");
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
            sheet={narrow ? { expanded: notesOpen, onToggle: () => setNotesOpen((o) => !o) } : undefined}
          />
        )}
      </div>
      {notesOpen && !narrow && connectorParagraphs.hover && (
        <NoteConnector paragraph={connectorParagraphs.hover} pdfPane={pdfPane} notesPane={notesPane} variant="hover" />
      )}
      {notesOpen && !narrow && connectorParagraphs.active && (
        <NoteConnector paragraph={connectorParagraphs.active} pdfPane={pdfPane} notesPane={notesPane} variant="active" />
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
      {openConcept && conceptMatcher.byId.has(openConcept.id) && (() => {
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
            onHighlight={() => setHighlight({ conceptId: concept.id, occurrences: null, index: 0 })}
            inReview={inReview("concept", concept.id)}
            onToggleReview={() => toggleReview("concept", concept.id)}
            onClose={() => setOpenConcept(null)}
          />
        );
      })()}
    </div>
  );
}
