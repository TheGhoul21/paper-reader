import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { findMatches, highlightMatchInDom, type SearchMatch } from "./search";

export function usePdfSearch(doc: PDFDocumentProxy | null) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const navigation = useRef<AbortController | null>(null);
  const flash = (match: SearchMatch, text: string) => {
    navigation.current?.abort();
    const controller = new AbortController();
    navigation.current = controller;
    highlightMatchInDom(match, text, controller.signal).catch(() => {
      if (!controller.signal.aborted) setStatus("error");
    });
  };
  useEffect(() => {
    setMatches([]);
    setIndex(0);
    navigation.current?.abort();
    if (!doc || !query.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      findMatches(doc, query, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setMatches(found);
          setStatus("ready");
          if (found.length) flash(found[0], query);
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
      navigation.current?.abort();
    };
  }, [doc, query, attempt]);
  return {
    query,
    setQuery,
    status,
    count: matches.length,
    index,
    retry: () => setAttempt((n) => n + 1),
    move: (delta: number) => {
      if (!matches.length) return;
      const next = (index + delta + matches.length) % matches.length;
      setIndex(next);
      flash(matches[next], query);
    },
  };
}
