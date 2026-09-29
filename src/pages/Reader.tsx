import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import { useAnnotations } from "../lib/annotations";
import { papersUrl } from "../lib/paths";
import type { Concept, ConceptsIndex, PaperMeta, PaperStructure, Paragraph } from "../types";

export default function Reader() {
  const { slug } = useParams<{ slug: string }>();
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [conceptsIndex, setConceptsIndex] = useState<ConceptsIndex>({});
  const [structure, setStructure] = useState<PaperStructure | null>(null);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const { annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(slug ?? "");

  useEffect(() => {
    if (!slug) return;
    setMeta(null);
    setParagraphs(null);
    setConcepts([]);
    setStructure(null);
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
      // Optional: papers imported before the glossary existed have no concepts.json (and the
      // dev server answers a missing file with the SPA's index.html, hence the catch).
      fetch(papersUrl(`${slug}/concepts.json`))
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(papersUrl("concepts-index.json"))
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
      fetch(papersUrl(`${slug}/structure.json`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([m, p, c, ci, st]: [PaperMeta, Paragraph[], Concept[], ConceptsIndex, PaperStructure | null]) => {
        setMeta(m);
        setParagraphs(p);
        setConcepts(Array.isArray(c) ? c : []);
        setConceptsIndex(ci && typeof ci === "object" && !Array.isArray(ci) ? ci : {});
        setStructure(st && Array.isArray(st.claims) ? st : null);
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
        concepts={concepts}
        conceptsIndex={conceptsIndex}
        structure={structure}
        tldr={meta.tldr}
        slug={slug ?? ""}
        initialParagraphId={searchParams.get("p")}
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
