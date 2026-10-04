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
  defaultSize?: { width: number; height: number }; // unscaled first-page size until this page is measured
  paragraphs: Paragraph[];
  numbers: Map<string, number>;
  activeId: string | null;
  hoverId: string | null;
  onSelect: (paragraph: Paragraph) => void;
  onHoverParagraph: (id: string | null) => void;
  onJumpToPage: (pageNumber: number) => void;
  onCitation: (text: string, pageNumber: number, clientPos: { x: number; y: number }) => void;
  thread?: Set<string> | null;
  focus?: Set<string> | null;
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
  defaultSize,
  paragraphs,
  numbers,
  activeId,
  hoverId,
  onSelect,
  onHoverParagraph,
  onJumpToPage,
  onCitation,
  thread,
  focus,
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
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const dimensions = pageSize ?? defaultSize;
  const size = dimensions
    ? { width: dimensions.width * scale, height: dimensions.height * scale }
    : null;
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aspectCancelled = false;
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (aspectCancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
      })
      .catch((err: unknown) => {
        if (!aspectCancelled) setError(String(err));
      });
    return () => {
      aspectCancelled = true;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.target === el);
        if (entry) setVisible(entry.isIntersecting);
      },
      { root: el.closest(".pdf-viewer"), rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber]);

  useEffect(() => {
    setRenderedScale(null);
    setError(null);
    if (!visible) {
      setPageProxy(null);
      return;
    }
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
    doc
      .getPage(pageNumber)
      .then(async (page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Render at native device pixel density (HiDPI/Retina), then scale the
        // canvas back down via CSS — otherwise the browser upscales a 1x bitmap
        // and the page looks grainy on any screen with devicePixelRatio > 1.
        // Bound one canvas to 16M pixels, including Retina and high zoom levels.
        const outputScale = Math.min(
          window.devicePixelRatio || 1,
          Math.sqrt(16_000_000 / (viewport.width * viewport.height)),
        );
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) return;
        setPageSize({ width: viewport.width / scale, height: viewport.height / scale });
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
      })
      .catch((err: unknown) => {
        if (!cancelled && !(err instanceof Error && err.name === "RenderingCancelledException"))
          setError(String(err));
      });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [visible, doc, pageNumber, scale]);

  const rendered = visible && renderedScale === scale && size !== null;
  // Stable viewport reference: pageProxy.getViewport() returns a new object every call, and
  // TextLayer's effect keys off this by reference — recreating it on every parent re-render
  // (e.g. from scroll-driven currentPage updates) would tear down and rebuild the text layer
  // constantly, wiping any transient state (like a search-match highlight) almost immediately.
  const textLayerViewport = useMemo(() => pageProxy?.getViewport({ scale }), [pageProxy, scale]);

  return (
    <div
      id={`page-${pageNumber}`}
      ref={containerRef}
      className="pdf-page"
      style={size ? { width: size.width, height: size.height } : undefined}
    >
      {visible && <canvas ref={canvasRef} />}
      {error && (
        <p className="state-message" role="alert">
          Impossibile visualizzare questa pagina: {error}
        </p>
      )}
      {rendered && size && pageProxy && textLayerViewport && (
        <TextLayer page={pageProxy} viewport={textLayerViewport} />
      )}
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
          thread={thread}
          focus={focus}
        />
      )}
      {rendered && size && pageProxy && textLayerViewport && (
        <LinkLayer
          doc={doc}
          page={pageProxy}
          viewport={textLayerViewport}
          onJumpToPage={onJumpToPage}
          onCitation={onCitation}
        />
      )}
      {size && (
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
