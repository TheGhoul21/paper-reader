import { useEffect, useRef } from "react";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { pdfjsLib } from "../lib/pdfjs";

interface Props {
  page: PDFPageProxy;
  viewport: PageViewport;
}

export default function TextLayer({ page, viewport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    delete container.dataset.rendered;
    container.style.setProperty("--scale-factor", String(viewport.scale));

    let cancelled = false;
    const textContentSource = page.streamTextContent();
    const layer = new pdfjsLib.TextLayer({ textContentSource, container, viewport });
    layer
      .render()
      .then(() => {
        if (!cancelled) container.dataset.rendered = "true";
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("text layer render failed", err);
      });

    return () => {
      cancelled = true;
      delete container.dataset.rendered;
      layer.cancel();
    };
  }, [page, viewport]);

  return <div ref={containerRef} className="textLayer" data-page-container />;
}
