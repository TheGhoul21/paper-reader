import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import { useAnnotations } from "../lib/annotations";
import { papersUrl } from "../lib/paths";
import type { PaperMeta, Paragraph } from "../types";

export default function Reader() {
  const { slug } = useParams<{ slug: string }>();
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const { annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(slug ?? "");

  useEffect(() => {
    if (!slug) return;
    setMeta(null);
    setParagraphs(null);
    setError(null);
    setVariant(null);
    Promise.all([
      fetch(papersUrl(`${slug}/meta.json`)).then((r) => {
        if (!r.ok) throw new Error(`meta.json: ${r.status}`);
        return r.json();
      }),
      fetch(papersUrl(`${slug}/paragraphs.json`)).then((r) => {
        if (!r.ok) throw new Error(`paragraphs.json: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([m, p]: [PaperMeta, Paragraph[]]) => {
        setMeta(m);
        setParagraphs(p);
        setVariant(m.variants[0]?.key ?? null);
      })
      .catch((err) => setError(String(err)));
  }, [slug]);

  if (error) return <p className="state-message">Could not load paper: {error}</p>;
  if (!meta || !paragraphs || !variant) return <p className="state-message">Loading…</p>;

  return (
    <div className="reader-page">
      <PdfViewer
        title={meta.title}
        authors={meta.authors}
        pdfUrl={papersUrl(`${slug}/source/paper.pdf`)}
        paragraphs={paragraphs}
        variants={meta.variants}
        variant={variant}
        onVariantChange={setVariant}
        annotations={annotations}
        onAddAnnotation={addAnnotation}
        onUpdateAnnotation={updateAnnotation}
        onDeleteAnnotation={deleteAnnotation}
      />
    </div>
  );
}
