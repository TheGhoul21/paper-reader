import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type FitMode = "none" | "width" | "page";
export function usePdfViewport(
  doc: PDFDocumentProxy | null,
  nativeSize: { width: number; height: number } | null,
  pane: HTMLElement | null,
) {
  const [scale, setScale] = useState(1.5);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    if (!pane || !nativeSize || fitMode === "none") return;
    const apply = () => {
      const style = getComputedStyle(pane);
      const width =
        pane.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height =
        pane.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width <= 0 || height <= 0) return;
      setScale(
        fitMode === "width"
          ? width / nativeSize.width
          : Math.min(width / nativeSize.width, height / nativeSize.height),
      );
    };
    const observer = new ResizeObserver(apply);
    observer.observe(pane);
    apply();
    return () => observer.disconnect();
  }, [pane, nativeSize, fitMode]);
  useEffect(() => {
    if (!doc || !pane) return;
    let frame = 0;
    const compute = () => {
      const reference = pane.getBoundingClientRect().top + 10;
      let best = 1;
      for (const page of pane.querySelectorAll<HTMLElement>(".pdf-page")) {
        if (page.getBoundingClientRect().top <= reference) best = Number(page.id.slice(5));
        else break;
      }
      setCurrentPage(best);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      pane.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [doc, scale, pane]);
  const jumpToPage = (page: number) => {
    if (!doc || !Number.isFinite(page)) return;
    const target = Math.min(doc.numPages, Math.max(1, Math.round(page)));
    pane?.querySelector(`#page-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(target);
  };
  return {
    scale,
    fitMode,
    currentPage,
    setFitMode,
    jumpToPage,
    zoom: (delta: number) => {
      setFitMode("none");
      setScale((s) => Math.min(5.25, Math.max(0.25, s + delta)));
    },
  };
}
