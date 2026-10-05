import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib } from "./pdfjs";

export function usePdfDocument(url: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setNativeSize(null);
    setError(null);
    const task = pdfjsLib.getDocument(url);
    task.promise
      .then(async (loaded) => {
        const page = await loaded.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setNativeSize({ width: viewport.width, height: viewport.height });
        setDoc(loaded);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(String(reason));
      });
    return () => {
      cancelled = true;
      task.destroy().catch((reason: unknown) => {
        console.error("PDF document cleanup failed", reason);
      });
    };
  }, [url, attempt]);
  return { doc, nativeSize, error, retry: () => setAttempt((n) => n + 1) };
}
