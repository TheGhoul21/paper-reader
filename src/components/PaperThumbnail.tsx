import { useEffect, useRef, useState } from "react";
import { pdfjsLib } from "../lib/pdfjs";
import { LibraryIcon } from "./icons";

interface Props {
  pdfUrl: string;
  label: string;
}

const TARGET_WIDTH = 220;

/** Renders the PDF's first page as a small cover image, loaded lazily and only once in view. */
export default function PaperThumbnail({ pdfUrl, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"pending" | "loaded" | "failed">("pending");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || status !== "pending") return;
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise
      .then((doc) => doc.getPage(1))
      .then((page) => {
        if (cancelled) return null;
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = TARGET_WIDTH / baseViewport.width;
        const outputScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) return null;
        return page.render({
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        }).promise;
      })
      .then(() => {
        if (!cancelled) setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [visible, status, pdfUrl]);

  return (
    <div ref={containerRef} className="paper-thumb" role="img" aria-label={label}>
      <canvas ref={canvasRef} style={{ display: status === "loaded" ? "block" : "none" }} />
      {status !== "loaded" && (
        <div className="paper-thumb-placeholder">
          <LibraryIcon width={22} height={22} />
        </div>
      )}
    </div>
  );
}
