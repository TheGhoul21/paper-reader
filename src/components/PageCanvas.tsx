import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import ParagraphOverlay from "./ParagraphOverlay";
import AnnotationLayer from "./AnnotationLayer";
import TextLayer from "./TextLayer";
import LinkLayer from "./LinkLayer";
import type { Annotation, AnnotationTool, Paragraph } from "../types";

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number; // 1-indexed, matches pdf.js
  scale: number;
  paragraphs: Paragraph[];
  numbers: Map<string, number>;
  activeId: string | null;
  hoverId: string | null;
  onSelect: (paragraph: Paragraph) => void;
  onHoverParagraph: (id: string | null) => void;
  onJumpToPage: (pageNumber: number) => void;
  onCitation: (text: string, pageNumber: number, clientPos: { x: number; y: number }) => void;
  tool: AnnotationTool;
  color: string;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
}

export default function PageCanvas({
  doc,
  pageNumber,
  scale,
  paragraphs,
  numbers,
  activeId,
  hoverId,
  onSelect,
  onHoverParagraph,
  onJumpToPage,
  onCitation,
  tool,
  color,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [renderedScale, setRenderedScale] = useState<number | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    let aspectCancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (aspectCancelled) return;
      const viewport = page.getViewport({ scale });
      setSize({ width: viewport.width, height: viewport.height });
    });
    return () => {
      aspectCancelled = true;
    };
  }, [doc, pageNumber, scale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  useEffect(() => {
    if (!visible || renderedScale === scale) return;
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
    doc.getPage(pageNumber).then(async (page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Render at native device pixel density (HiDPI/Retina), then scale the
      // canvas back down via CSS — otherwise the browser upscales a 1x bitmap
      // and the page looks grainy on any screen with devicePixelRatio > 1.
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      setSize({ width: viewport.width, height: viewport.height });
      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      await renderTask.promise;
      if (!cancelled) {
        setRenderedScale(scale);
        setPageProxy(page);
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [visible, renderedScale, doc, pageNumber, scale]);

  const rendered = renderedScale === scale && size !== null;
  // Stable viewport reference: pageProxy.getViewport() returns a new object every call, and
  // TextLayer's effect keys off this by reference — recreating it on every parent re-render
  // (e.g. from scroll-driven currentPage updates) would tear down and rebuild the text layer
  // constantly, wiping any transient state (like a search-match highlight) almost immediately.
  const textLayerViewport = useMemo(() => pageProxy?.getViewport({ scale }), [pageProxy, scale]);

  return (
    <div id={`page-${pageNumber}`} ref={containerRef} className="pdf-page" style={size ? { width: size.width, height: size.height } : undefined}>
      <canvas ref={canvasRef} />
      {rendered && size && pageProxy && textLayerViewport && <TextLayer page={pageProxy} viewport={textLayerViewport} />}
      {rendered && size && (
        <ParagraphOverlay
          paragraphs={paragraphs}
          numbers={numbers}
          width={size.width}
          height={size.height}
          activeId={activeId}
          hoverId={hoverId}
          onSelect={onSelect}
          onHover={onHoverParagraph}
        />
      )}
      {rendered && size && pageProxy && textLayerViewport && (
        <LinkLayer doc={doc} page={pageProxy} viewport={textLayerViewport} onJumpToPage={onJumpToPage} onCitation={onCitation} />
      )}
      {rendered && size && (
        <AnnotationLayer
          page={pageNumber - 1}
          width={size.width}
          height={size.height}
          tool={tool}
          color={color}
          annotations={annotations}
          onAdd={onAddAnnotation}
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
        />
      )}
    </div>
  );
}
