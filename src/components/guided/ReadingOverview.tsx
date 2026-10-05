import type { PaperData } from "../../lib/papers";
import type { GuidedStop } from "../../lib/guidedReading";
import { pickVariant } from "../../lib/structure";
import { pickTldr } from "../TldrStrip";
import { ReadingCoverage, ReadingRoute } from "./ReadingNavigation";

export default function ReadingOverview({
  data,
  stops,
  variant,
  hasProgress,
  explored,
  doubts,
  onStart,
  onResume,
  onOpen,
}: {
  data: PaperData;
  stops: GuidedStop[];
  variant: string;
  hasProgress: boolean;
  explored: Set<string>;
  doubts: Set<string>;
  onStart: () => void;
  onResume: () => void;
  onOpen: (index: number) => void;
}) {
  const selected = data.meta.variants.find((item) => item.key === variant);
  const summary = pickTldr(data.meta.tldr, selected?.language);
  return (
    <section className="guided-arrival">
      <div className="guided-arrival-main">
        <h1 tabIndex={-1} data-guided-heading>
          {data.meta.title}
        </h1>
        <div className="guided-paper-identity">
          <span>
            {data.meta.pageCount} pagine · {data.meta.authors.join(", ")}
          </span>
          <ReadingCoverage data={data} />
        </div>
        <div className="guided-actions">
          <button className="guided-primary" onClick={hasProgress ? onResume : onStart}>
            {hasProgress ? "Riprendi il percorso" : "Inizia dal quadro generale"}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <span>
            {hasProgress
              ? `${explored.size}/${stops.length} tappe esplorate · ${doubts.size} da rivedere`
              : `${stops.length} tappe`}
          </span>
        </div>
        {summary && (
          <div className="guided-start-question">
            <span className="guided-eyebrow">Il problema</span>
            <p>{summary.problem.split(/(?<=[.!?])\s+/)[0]}</p>
            <details>
              <summary>Leggi il contesto completo</summary>
              <p>{summary.problem}</p>
              <h3>La proposta degli autori</h3>
              <p>{summary.idea}</p>
              {summary.why && (
                <>
                  <h3>Motivazione del lavoro</h3>
                  <p>{summary.why}</p>
                </>
              )}
            </details>
          </div>
        )}
        <details className="guided-level-preview">
          <summary>Livello delle spiegazioni</summary>
          <p>{data.meta.background || selected?.label}</p>
          <h3>Esempio</h3>
          <p>{pickVariant(stops[0].step.meaning, variant)}</p>
          <small>Puoi cambiare livello dal selettore in alto durante la lettura.</small>
        </details>
        {hasProgress && (
          <button className="guided-text-button" onClick={onStart}>
            Rileggi dalla prima tappa
          </button>
        )}
      </div>
      <aside className="guided-route-preview">
        <h2>Percorso di lettura</h2>
        <ReadingRoute
          stops={stops}
          variant={variant}
          explored={explored}
          doubts={doubts}
          onOpen={onOpen}
        />
      </aside>
    </section>
  );
}
