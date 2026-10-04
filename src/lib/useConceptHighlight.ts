import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfSpellings, spellingPattern, type ConceptMatcher } from "./concepts";
import {
  findOccurrences,
  markTextLayers,
  scrollToOccurrence,
  unmarkTextLayers,
  type Occurrence,
} from "./conceptHighlight";

export function useConceptHighlight(
  doc: PDFDocumentProxy | null,
  pane: HTMLElement | null,
  matcher: ConceptMatcher,
) {
  const [highlight, setHighlight] = useState<{
    id: string;
    occurrences: Occurrence[] | null;
    index: number;
    error?: boolean;
  } | null>(null);
  const concept = highlight ? (matcher.byId.get(highlight.id) ?? null) : null;
  const pattern = useMemo(
    () => (concept ? spellingPattern(pdfSpellings(concept)) : null),
    [concept],
  );
  const navigation = useRef<AbortController | null>(null);
  const scroll = (occurrence: Occurrence, identity: string) => {
    navigation.current?.abort();
    const controller = new AbortController();
    navigation.current = controller;
    void scrollToOccurrence(occurrence, controller.signal, identity);
  };
  useEffect(() => {
    navigation.current?.abort();
    if (!doc || !pattern) return;
    const controller = new AbortController();
    findOccurrences(doc, pattern, controller.signal)
      .then((occurrences) => {
        if (controller.signal.aborted) return;
        setHighlight((h) => (h ? { ...h, occurrences, index: 0 } : null));
        if (occurrences.length) scroll(occurrences[0], pattern.source);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHighlight((h) => (h ? { ...h, error: true } : null));
      });
    return () => {
      controller.abort();
      navigation.current?.abort();
    };
  }, [doc, pattern]);
  useEffect(() => {
    if (!pane || !pattern) return;
    let frame = 0;
    const apply = () => markTextLayers(pane, pattern);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    });
    observer.observe(pane, { childList: true, subtree: true });
    apply();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      unmarkTextLayers(pane);
    };
  }, [pane, pattern]);
  return {
    highlight,
    concept,
    open: (id: string) => setHighlight({ id, occurrences: null, index: 0 }),
    close: () => {
      navigation.current?.abort();
      setHighlight(null);
    },
    move: (delta: number) => {
      if (!highlight?.occurrences?.length || !pattern) return;
      const index =
        (highlight.index + delta + highlight.occurrences.length) % highlight.occurrences.length;
      setHighlight({ ...highlight, index });
      scroll(highlight.occurrences[index], pattern.source);
    },
  };
}
