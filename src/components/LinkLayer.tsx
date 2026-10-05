import { useEffect, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import { resolveLinkTarget, type LinkTarget } from "../lib/citation";

interface PdfLinkAnnotation {
  subtype?: string;
  rect?: [number, number, number, number];
  url?: string;
  dest?: string | unknown[] | null;
}

interface ResolvedLink {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  href?: string;
  target?: LinkTarget;
}

interface Props {
  doc: PDFDocumentProxy;
  page: PDFPageProxy;
  viewport: PageViewport;
  onJumpToPage: (pageNumber: number) => void;
  onCitation: (text: string, pageNumber: number, clientPos: { x: number; y: number }) => void;
}

// pdf.js citation/reference links (both external URLs and internal "jump to reference"
// links) come from the PDF's own Link annotations, separate from our paragraph data.
// We render them as a thin layer above ParagraphOverlay so only the small link rect
// intercepts the click — the rest of the paragraph still opens the explanation.
export default function LinkLayer({ doc, page, viewport, onJumpToPage, onCitation }: Props) {
  const [links, setLinks] = useState<ResolvedLink[]>([]);

  useEffect(() => {
    let cancelled = false;

    page
      .getAnnotations({ intent: "display" })
      .then(async (annotations: PdfLinkAnnotation[]) => {
        // The viewer may have been closed while pdf.js was still answering.
        if (cancelled) return;
        const linkAnnotations = annotations.filter((a) => a.subtype === "Link" && a.rect);
        const resolved = await Promise.all(
          linkAnnotations.map(async (a, i): Promise<ResolvedLink | null> => {
            const [vx0, vy0, vx1, vy1] = viewport.convertToViewportRectangle(a.rect!);
            const left = Math.min(vx0, vx1);
            const top = Math.min(vy0, vy1);
            const width = Math.abs(vx1 - vx0);
            const height = Math.abs(vy1 - vy0);
            const key = `${page.pageNumber}-${i}`;

            if (a.url) {
              return { key, left, top, width, height, href: a.url };
            }
            if (!a.dest) return null;

            const target = await resolveLinkTarget(doc, a.dest);
            if (!target) return null;
            return { key, left, top, width, height, target };
          }),
        );

        if (!cancelled) setLinks(resolved.filter((l): l is ResolvedLink => l !== null));
      })
      .catch((reason: unknown) => {
        // Leaving the PDF terminates its worker and rejects pending requests.
        if (!cancelled) console.error("PDF link annotations failed", reason);
      });

    return () => {
      cancelled = true;
    };
  }, [doc, page, viewport]);

  if (links.length === 0) return null;

  return (
    <div className="link-layer" style={{ width: viewport.width, height: viewport.height }}>
      {links.map((l) =>
        l.href ? (
          <a
            key={l.key}
            className="pdf-link"
            style={{ left: l.left, top: l.top, width: l.width, height: l.height }}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={l.href}
          />
        ) : (
          <button
            key={l.key}
            className="pdf-link"
            style={{ left: l.left, top: l.top, width: l.width, height: l.height }}
            onClick={(e) => {
              if (!l.target) return;
              if (l.target.type === "citation") {
                onCitation(l.target.text, l.target.pageNumber, { x: e.clientX, y: e.clientY });
              } else {
                onJumpToPage(l.target.pageNumber);
              }
            }}
            aria-label="Show reference"
          />
        ),
      )}
    </div>
  );
}
