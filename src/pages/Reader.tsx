import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import UndoNotice, { useUndo } from "../components/UndoNotice";
import { useAnnotations } from "../lib/annotations";
import { papersUrl } from "../lib/paths";
import { loadPaper, type PaperData } from "../lib/papers";
import { saveReadingPosition, type ReadingPosition } from "../lib/readingProgress";
import { userDataStore } from "../lib/storage";
import { guidedUrl } from "../lib/guidedReading";

const GuidedReading = lazy(() => import("./GuidedReading"));

function LoadedReader({ slug, data }: { slug: string; data: PaperData }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [position] = useState(() => userDataStore.getSnapshot().data.reading?.[slug]);
  const [journey] = useState(() => userDataStore.getSnapshot().data.journeys?.[slug]);
  const hasGuide = !!data.structure?.readingGuide?.some((section) => section.steps.length);
  const pdfMode =
    params.get("view") === "pdf" ||
    (params.has("p") && params.get("view") !== "guide") ||
    !hasGuide;
  const [variant, setVariant] = useState(() => {
    const requested =
      params.get("v") ?? (pdfMode ? position?.variant : journey?.variant) ?? position?.variant;
    return data.meta.variants.find((v) => v.key === requested)?.key ?? data.meta.variants[0].key;
  });
  const shownVariant = data.meta.variants.find((v) => v.key === params.get("v"))?.key ?? variant;
  function chooseVariant(key: string) {
    setVariant(key);
    const next = new URLSearchParams(params);
    next.set("v", key);
    setParams(next, { replace: true, state: location.state });
  }
  const { annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(slug);
  const undo = useUndo();
  const savePosition = useCallback(
    (progress: Omit<ReadingPosition, "updatedAt">) => saveReadingPosition(slug, progress),
    [slug],
  );
  const { meta, paragraphs, concepts, conceptsIndex, structure } = data;
  if (!pdfMode)
    return (
      <Suspense fallback={<p className="state-message">Caricamento percorso…</p>}>
        <GuidedReading data={data} variant={shownVariant} onVariant={chooseVariant} />
      </Suspense>
    );
  const returnUrl =
    params.get("from") === "guide" && params.get("step")
      ? guidedUrl(slug, {
          stepId: params.get("step")!,
          variant: shownVariant,
          phase: params.get("stage") === "summary" ? "summary" : "reading",
        })
      : params.get("p")
        ? `/paper/${slug}?view=guide&p=${encodeURIComponent(params.get("p")!)}&v=${encodeURIComponent(shownVariant)}`
        : guidedUrl(slug);
  return (
    <div className="reader-page">
      <PdfViewer
        readerNavigation={
          hasGuide ? (
            <div className="reader-mode-bar">
              <Link to={returnUrl} state={location.state}>
                {params.get("from") === "guide"
                  ? "← Torna al percorso"
                  : "Apri il percorso guidato →"}
              </Link>
              <span>Stai consultando il PDF originale</span>
            </div>
          ) : (
            <p className="reader-mode-bar">
              Il percorso guidato non è ancora disponibile. Puoi leggere e annotare il PDF.
            </p>
          )
        }
        title={meta.title}
        authors={meta.authors}
        pdfUrl={papersUrl(`${slug}/source/paper.pdf`)}
        paragraphs={paragraphs}
        concepts={concepts}
        conceptsIndex={conceptsIndex}
        structure={structure}
        tldr={meta.tldr}
        slug={slug}
        initialParagraphId={params.get("p") ?? position?.paragraphId ?? null}
        initialPage={position?.page}
        onProgress={savePosition}
        variants={meta.variants}
        variant={shownVariant}
        onVariantChange={chooseVariant}
        annotations={annotations}
        onAddAnnotation={addAnnotation}
        onUpdateAnnotation={updateAnnotation}
        onDeleteAnnotation={(id) => {
          const note = annotations.find((a) => a.id === id);
          deleteAnnotation(id);
          if (note) undo.remember("Nota eliminata", () => addAnnotation(note));
        }}
      />
      <UndoNotice {...undo} />
    </div>
  );
}

export default function Reader() {
  const { slug } = useParams<{ slug: string }>();
  const [loaded, setLoaded] = useState<{ slug: string; data?: PaperData; error?: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    loadPaper(slug, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setLoaded({ slug, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoaded({ slug, error: String(error) });
      },
    );
    return () => controller.abort();
  }, [slug, attempt]);
  if (loaded?.slug === slug && loaded?.error)
    return (
      <div className="state-message" role="alert">
        <p>Impossibile caricare il paper: {loaded.error}</p>
        <button
          onClick={() => {
            setLoaded(null);
            setAttempt((n) => n + 1);
          }}
        >
          Riprova
        </button>
      </div>
    );
  if (!slug || loaded?.slug !== slug || !loaded.data)
    return (
      <p className="state-message" role="status">
        Caricamento…
      </p>
    );
  return <LoadedReader key={slug} slug={slug} data={loaded.data} />;
}
