import { Link, useLocation } from "react-router-dom";
import type { PaperData } from "../../lib/papers";
import type { GuidedStop } from "../../lib/guidedReading";
import { pickVariant } from "../../lib/structure";
import { cardId, useReview } from "../../lib/review";
import { pickTldr } from "../TldrStrip";
import { ReadingCoverage } from "./ReadingNavigation";
import { ReadingCheckpoint, type ReadingTools } from "./ReadingContent";

export default function ReadingSummary({
  data,
  stops,
  tools,
  explored,
  doubts,
  reflection,
  onReflect,
  onOpen,
  onOverview,
}: {
  data: PaperData;
  stops: GuidedStop[];
  tools: ReadingTools;
  explored: Set<string>;
  doubts: Set<string>;
  reflection: string;
  onReflect: (text: string) => void;
  onOpen: (index: number) => void;
  onOverview: () => void;
}) {
  const { variant } = tools;
  const location = useLocation();
  const summary = pickTldr(
    data.meta.tldr,
    data.meta.variants.find((v) => v.key === variant)?.language,
  );
  const revisits = stops.flatMap((stop, index) =>
    doubts.has(stop.step.id) ? [{ stop, index }] : [],
  );
  const { cards, addCards } = useReview();
  const nextPapers = new Map<string, { title: string; term: string }>();
  for (const concept of data.concepts) {
    for (const paper of data.conceptsIndex[concept.id] ?? []) {
      if (paper.slug !== data.meta.slug && !nextPapers.has(paper.slug))
        nextPapers.set(paper.slug, { title: paper.title, term: concept.term });
    }
  }
  const checkpoints = stops
    .filter((stop) => explored.has(stop.step.id) && stop.paragraphs.some((p) => p.recall?.length))
    .slice(0, 3);
  return (
    <section className="guided-finish">
      <h1 tabIndex={-1} data-guided-heading>
        Sintesi del paper
      </h1>
      <p className="guided-lead">
        {explored.size} di {stops.length} tappe esplorate.
      </p>
      <div className="guided-synthesis">
        {summary ? (
          [
            { title: "Il problema", text: summary.problem },
            { title: "La proposta", text: summary.idea },
            { title: "Il risultato", text: summary.result },
          ].map((item, i) => (
            <section key={item.title}>
              <span>0{i + 1}</span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </section>
          ))
        ) : (
          <p>{pickVariant(data.structure?.thesis ?? {}, variant)}</p>
        )}
      </div>
      {summary?.why && (
        <div className="guided-result-context">
          <h2>Motivazione del lavoro</h2>
          <p>{summary.why}</p>
        </div>
      )}
      <ReadingCoverage data={data} />
      <div className="guided-closing-notes">
        <label>
          <strong>La mia sintesi</strong>
          <textarea
            aria-label="La mia sintesi del paper"
            value={reflection}
            onChange={(e) => onReflect(e.target.value)}
            placeholder="Il problema è… L'idea degli autori è… Le prove mostrano… Resta da capire…"
          />
          <small>La sintesi e i dubbi fanno parte del tuo lavoro personale e del backup.</small>
        </label>
        <div className="guided-return-list">
          <h2>Tappe da rivedere</h2>
          {revisits.length ? (
            revisits.map(({ stop, index }) => {
              const items = stop.paragraphs.map((p) => ({
                slug: data.meta.slug,
                kind: "paragraph" as const,
                refId: p.id,
                variant,
              }));
              const added = items.every(
                (item) => !!cards[cardId(item.slug, item.kind, item.refId)],
              );
              return (
                <div key={stop.step.id}>
                  <button className="guided-revisit" onClick={() => onOpen(index)}>
                    {pickVariant(stop.step.title, variant)} <span aria-hidden="true">→</span>
                  </button>
                  <button
                    className="guided-review-toggle"
                    disabled={added || !items.length}
                    onClick={() => addCards(items)}
                  >
                    {added ? "Passaggi nel ripasso ✓" : "Aggiungi questi passaggi al ripasso"}
                  </button>
                </div>
              );
            })
          ) : (
            <p>Nessuna tappa segnata da rivedere.</p>
          )}
          {explored.size < stops.length && (
            <p>{stops.length - explored.size} tappe ancora da esplorare.</p>
          )}
        </div>
      </div>
      {data.structure && data.structure.claims.length > 0 && (
        <details className="guided-end-map">
          <summary>Tesi e prove</summary>
          {data.structure.claims.map((claim) => (
            <section key={claim.id}>
              <h3>{pickVariant(claim.title, variant)}</h3>
              <p>{pickVariant(claim.summary, variant)}</p>
              <div className="guided-evidence-links">
                {[...new Set([...claim.statedIn, ...claim.evidence])].map((id) => (
                  <Link
                    key={id}
                    to={tools.sourceUrl(id)}
                    state={location.state}
                    onClick={tools.onSource}
                  >
                    Passaggio {data.numbers.get(id)} nell'originale ↗
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </details>
      )}
      {checkpoints.length > 0 && (
        <details className="guided-final-checks">
          <summary>Domande di verifica</summary>
          {checkpoints.map((stop) => (
            <ReadingCheckpoint
              key={stop.step.id}
              paragraphs={stop.paragraphs}
              slug={data.meta.slug}
              variant={variant}
            />
          ))}
        </details>
      )}
      <div className="guided-finish-actions">
        <button className="guided-secondary" onClick={onOverview}>
          Ritorna al percorso
        </button>
        <Link className="guided-text-button" to="/review">
          Apri il ripasso →
        </Link>
      </div>
      {nextPapers.size > 0 && (
        <section className="guided-next-reading">
          <h2>Paper con concetti in comune</h2>
          {[...nextPapers.entries()].slice(0, 3).map(([slug, paper]) => (
            <Link key={slug} to={`/paper/${slug}`}>
              <strong>{paper.title}</strong>
              <span>Concetto in comune: {paper.term} →</span>
            </Link>
          ))}
        </section>
      )}
    </section>
  );
}
