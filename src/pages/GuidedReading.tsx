import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import type { PaperData } from "../lib/papers";
import { buildConceptMatcher } from "../lib/concepts";
import { guidedStops } from "../lib/guidedReading";
import { useGuidedReading } from "../lib/useGuidedReading";
import { useReaderPreferences } from "../lib/readingProgress";
import { downloadBackupFile } from "../lib/backup";
import { pickTldr } from "../components/TldrStrip";
import ReadingOverview from "../components/guided/ReadingOverview";
import ReadingStep from "../components/guided/ReadingStep";
import ReadingSummary from "../components/guided/ReadingSummary";
import ReadingGlossary, { type OpenConcept } from "../components/guided/ReadingGlossary";
import { ReadingHeader, ReadingRoute } from "../components/guided/ReadingNavigation";
import type { ReadingTools } from "../components/guided/ReadingContent";

export default function GuidedReading({
  data,
  variant,
  onVariant,
}: {
  data: PaperData;
  variant: string;
  onVariant: (key: string) => void;
}) {
  const stops = useMemo(() => guidedStops(data), [data]);
  const session = useGuidedReading(data.meta.slug, stops, variant);
  const preferences = useReaderPreferences();
  const location = useLocation();
  const librarySearch: unknown = location.state?.librarySearch;
  const libraryPath = location.state?.libraryPath === "/catalog" ? "/catalog" : "/";
  const libraryUrl =
    typeof librarySearch === "string" && librarySearch
      ? `${libraryPath}?${librarySearch}`
      : libraryPath;
  const [concept, setConcept] = useState<OpenConcept | null>(null);
  useEffect(() => {
    setConcept(null);
  }, [location.key]);
  const matcher = useMemo(() => buildConceptMatcher(data.concepts), [data.concepts]);
  const tools: ReadingTools = {
    slug: data.meta.slug,
    figures: data.structure?.figures ?? [],
    variant,
    matcher,
    onConcept: (id, anchor, paragraphId) => setConcept({ id, anchor, paragraphId }),
    onParagraph: session.goToParagraph,
    sourceUrl: session.sourceUrl,
    onSource: session.rememberSourceReturn,
  };
  const summary = pickTldr(
    data.meta.tldr,
    data.meta.variants.find((v) => v.key === variant)?.language,
  );
  return (
    <div
      className="guided-page"
      style={{ "--guided-text-size": `${preferences.fontSize}px` } as CSSProperties}
    >
      <ReadingHeader
        data={data}
        variant={variant}
        stage={session.stage}
        libraryUrl={libraryUrl}
        pdfUrl={session.sourceUrl(session.stop.paragraphs[0]?.id)}
        onSource={session.rememberSourceReturn}
        onVariant={onVariant}
        onOverview={session.showOverview}
        onRead={session.resume}
        onSummary={session.showSummary}
      />
      {session.unreadableStorage && (
        <div className="guided-content-notice" role="alert">
          <p>
            Questo percorso resta in memoria perché i dati precedenti non sono leggibili. Puoi
            scaricare il nuovo lavoro senza sovrascriverli.
          </p>
          <button
            className="guided-secondary"
            onClick={() =>
              downloadBackupFile({
                app: "paper-reader",
                version: 1,
                exportedAt: new Date().toISOString(),
                review: {},
                annotations: {},
                journeys: { [data.meta.slug]: session.progress },
              })
            }
          >
            Scarica il nuovo percorso
          </button>
        </div>
      )}
      {(session.outdated > 0 || session.invalidStep) && (
        <p className="guided-content-notice" role="status">
          Il percorso è stato aggiornato: alcuni riferimenti non sono più disponibili. La tua
          sintesi e i dubbi salvati sono conservati; puoi scegliere una tappa dall'indice.
        </p>
      )}
      {session.stage === "read" && (
        <details className="guided-mobile-route" key={session.stop.step.id}>
          <summary>
            Esplora il percorso{" "}
            <span>
              {session.explored.size}/{stops.length} tappe esplorate
            </span>
          </summary>
          <ReadingRoute
            stops={stops}
            variant={variant}
            currentId={session.stop.step.id}
            explored={session.explored}
            doubts={session.doubts}
            onOpen={session.openStep}
            compact
          />
        </details>
      )}
      {session.stage === "overview" ? (
        <ReadingOverview
          data={data}
          stops={stops}
          variant={variant}
          hasProgress={session.hasProgress}
          explored={session.explored}
          doubts={session.doubts}
          onStart={() => session.openStep(0)}
          onResume={session.resume}
          onOpen={session.openStep}
        />
      ) : session.stage === "read" ? (
        <ReadingStep
          slug={data.meta.slug}
          stops={stops}
          index={session.index}
          tools={tools}
          explored={session.explored}
          doubts={session.doubts}
          idea={summary?.idea}
          onOpen={session.openStep}
          onContinue={session.continueReading}
        />
      ) : (
        <ReadingSummary
          data={data}
          stops={stops}
          tools={tools}
          explored={session.explored}
          doubts={session.doubts}
          reflection={session.progress.reflection}
          onReflect={session.reflect}
          onOpen={session.openStep}
          onOverview={session.showOverview}
        />
      )}
      {concept && (
        <ReadingGlossary
          data={data}
          variant={variant}
          open={concept}
          onClose={() => setConcept(null)}
          onParagraph={session.goToParagraph}
          onConcept={(id) => setConcept({ ...concept, id })}
        />
      )}
    </div>
  );
}
