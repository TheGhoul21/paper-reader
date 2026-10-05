import { Link, useLocation } from "react-router-dom";
import type { GuidedStop } from "../../lib/guidedReading";
import { pickVariant } from "../../lib/structure";
import ReadingDiagram from "../ReadingDiagram";
import { ReadingRoute } from "./ReadingNavigation";
import {
  ReadingText,
  ReadingPassages,
  ReadingCheckpoint,
  type ReadingTools,
} from "./ReadingContent";

export default function ReadingStep({
  slug,
  stops,
  index,
  tools,
  explored,
  doubts,
  idea,
  onOpen,
  onContinue,
}: {
  slug: string;
  stops: GuidedStop[];
  index: number;
  tools: ReadingTools;
  explored: Set<string>;
  doubts: Set<string>;
  idea?: string;
  onOpen: (index: number) => void;
  onContinue: (doubt: boolean) => void;
}) {
  const stop = stops[index];
  const { variant } = tools;
  const location = useLocation();
  return (
    <section className="guided-reading">
      <aside className="guided-reading-route">
        <span className="guided-eyebrow">Il tuo percorso</span>
        <ReadingRoute
          stops={stops}
          variant={variant}
          currentId={stop.step.id}
          explored={explored}
          doubts={doubts}
          onOpen={onOpen}
          compact
        />
        <p>
          {explored.size}/{stops.length} tappe esplorate
        </p>
      </aside>
      <article className="guided-lesson" key={stop.step.id}>
        <div className="guided-lesson-location">
          <span>
            Tappa {index + 1} di {stops.length}
          </span>
          <span>{pickVariant(stop.section.title, variant)}</span>
        </div>
        <h1 tabIndex={-1} data-guided-heading>
          {pickVariant(stop.step.title, variant)}
        </h1>
        <div className="guided-grounding">
          <span className="guided-eyebrow">In breve</span>
          <ReadingText text={pickVariant(stop.step.meaning, variant)} tools={tools} />
        </div>
        {stop.step.diagram && <ReadingDiagram diagram={stop.step.diagram} variant={variant} />}
        <ReadingPassages paragraphs={stop.paragraphs} tools={tools} />
        <ReadingCheckpoint paragraphs={stop.paragraphs} slug={slug} variant={variant} />
        <div className="guided-step-actions">
          <button className="guided-primary" onClick={() => onContinue(false)}>
            {index === stops.length - 1
              ? "Mi è chiaro · vai alla sintesi"
              : "Mi è chiaro · continua"}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <button className="guided-secondary" onClick={() => onContinue(true)}>
            Da rivedere · continua
          </button>
          {index > 0 && (
            <button className="guided-text-button" onClick={() => onOpen(index - 1)}>
              ← Tappa precedente
            </button>
          )}
        </div>
      </article>
      <aside className="guided-reading-compass">
        <h2>Obiettivo della sezione</h2>
        <p>{pickVariant(stop.section.goal, variant)}</p>
        {idea && (
          <details>
            <summary>Proposta degli autori</summary>
            <p>{idea}</p>
          </details>
        )}
        <Link
          to={tools.sourceUrl(stop.paragraphs[0]?.id)}
          state={location.state}
          onClick={tools.onSource}
        >
          Confronta con l'originale ↗
        </Link>
      </aside>
    </section>
  );
}
