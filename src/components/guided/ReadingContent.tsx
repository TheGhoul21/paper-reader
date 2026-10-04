import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { segmentText, type ConceptMatcher } from "../../lib/concepts";
import { pickVariant } from "../../lib/structure";
import { cardId, useReview } from "../../lib/review";
import type { Paragraph } from "../../types";

const DeepDive = lazy(() => import("../DeepDive"));
export interface ReadingTools {
  variant: string;
  matcher: ConceptMatcher;
  onConcept: (id: string, anchor: { x: number; y: number }, paragraphId?: string) => void;
  onParagraph: (id: string) => void;
  sourceUrl: (paragraphId?: string) => string;
  onSource: () => void;
}

export function ReadingText({
  text,
  tools,
  paragraphId,
}: {
  text: string;
  tools: ReadingTools;
  paragraphId?: string;
}) {
  const segments = useMemo(() => segmentText(text, tools.matcher), [text, tools.matcher]);
  return (
    <p>
      {segments.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <button
            className="guided-term"
            key={i}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              tools.onConcept(part.conceptId, { x: rect.left, y: rect.bottom + 8 }, paragraphId);
            }}
          >
            {part.text}
          </button>
        ),
      )}
    </p>
  );
}

export function ReadingPassage({
  paragraph,
  tools,
}: {
  paragraph: Paragraph;
  tools: ReadingTools;
}) {
  const location = useLocation();
  const deepDive = paragraph.deepDive?.[tools.variant];
  const [deepOpen, setDeepOpen] = useState(false);
  return (
    <div className="guided-passage" id={`guided-p-${paragraph.id}`} tabIndex={-1}>
      <ReadingText
        text={pickVariant(paragraph.explanations, tools.variant)}
        tools={tools}
        paragraphId={paragraph.id}
      />
      <details className="guided-source">
        <summary>Confronta con il paper · pagina {paragraph.page + 1}</summary>
        <blockquote>{paragraph.sourceText}</blockquote>
        <Link to={tools.sourceUrl(paragraph.id)} state={location.state} onClick={tools.onSource}>
          Apri questo passaggio nel lettore PDF ↗
        </Link>
      </details>
      {deepDive && (
        <details
          className="guided-deep"
          onToggle={(event) => setDeepOpen(event.currentTarget.open)}
        >
          <summary>Approfondimento</summary>
          {deepOpen && (
            <Suspense fallback={<p>Caricamento approfondimento…</p>}>
              <DeepDive markdown={deepDive} onGoToParagraph={tools.onParagraph} />
            </Suspense>
          )}
        </details>
      )}
    </div>
  );
}

export function ReadingPassages({
  paragraphs,
  tools,
}: {
  paragraphs: Paragraph[];
  tools: ReadingTools;
}) {
  const visible = paragraphs.length > 6 ? paragraphs.slice(0, 4) : paragraphs;
  const extra = paragraphs.slice(visible.length);
  return (
    <div className="guided-explanations">
      <h2>Spiegazioni</h2>
      {visible.map((paragraph) => (
        <ReadingPassage key={paragraph.id} paragraph={paragraph} tools={tools} />
      ))}
      {extra.length > 0 && (
        <details className="guided-extra-passages">
          <summary>Leggi gli altri {extra.length} passaggi di questa tappa</summary>
          {extra.map((paragraph) => (
            <ReadingPassage key={paragraph.id} paragraph={paragraph} tools={tools} />
          ))}
        </details>
      )}
    </div>
  );
}

export function ReadingCheckpoint({
  paragraphs,
  slug,
  variant,
}: {
  paragraphs: Paragraph[];
  slug: string;
  variant: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const question = paragraphs.flatMap((paragraph) =>
    (paragraph.recall ?? []).map((item) => ({ paragraph, item })),
  )[0];
  const { cards, addCards, removeCard } = useReview();
  const refId = question ? `${question.paragraph.id}#${question.item.id}` : "";
  const id = cardId(slug, "question", refId);
  return (
    <aside className="guided-checkpoint">
      <span className="guided-eyebrow">Verifica</span>
      <h3>
        {question ? pickVariant(question.item.q, variant) : "Spiega questa tappa con parole tue."}
      </h3>
      {question && (
        <>
          <button
            className="guided-text-button"
            aria-expanded={showAnswer}
            onClick={() => setShowAnswer((value) => !value)}
          >
            {showAnswer ? "Nascondi risposta" : "Mostra risposta"}
          </button>
          {showAnswer && <p>{pickVariant(question.item.a, variant)}</p>}
          <button
            className="guided-review-toggle"
            aria-pressed={!!cards[id]}
            onClick={() =>
              cards[id] ? removeCard(id) : addCards([{ slug, kind: "question", refId, variant }])
            }
          >
            {cards[id] ? "Domanda nel ripasso ✓" : "Aggiungi questa domanda al ripasso"}
          </button>
        </>
      )}
    </aside>
  );
}
