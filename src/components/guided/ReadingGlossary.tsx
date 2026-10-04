import { Link } from "react-router-dom";
import type { PaperData } from "../../lib/papers";
import { pickVariant } from "../../lib/structure";
import { cardId, useReview } from "../../lib/review";
import Popover from "../Popover";

export interface OpenConcept {
  id: string;
  anchor: { x: number; y: number };
  paragraphId?: string;
}

export default function ReadingGlossary({
  data,
  variant,
  open,
  onClose,
  onConcept,
  onParagraph,
}: {
  data: PaperData;
  variant: string;
  open: OpenConcept;
  onClose: () => void;
  onConcept: (id: string) => void;
  onParagraph: (id: string) => void;
}) {
  const concept = data.concepts.find((item) => item.id === open.id);
  const { cards, addCards, removeCard } = useReview();
  if (!concept) return null;
  const id = cardId(data.meta.slug, "concept", concept.id);
  const related = data.concepts.filter((item) => concept.related.includes(item.id));
  const elsewhere = (data.conceptsIndex[concept.id] ?? []).filter(
    (paper) => paper.slug !== data.meta.slug,
  );
  return (
    <Popover
      anchor={open.anchor}
      onClose={onClose}
      label={`Glossario: ${concept.term}`}
      className="guided-glossary"
    >
      <span className="guided-eyebrow">Glossario</span>
      <h2>{concept.term}</h2>
      <p>{pickVariant(concept.definitions, variant)}</p>
      {related.length > 0 && (
        <div className="guided-related">
          <span>Vedi anche</span>
          {related.map((item) => (
            <button key={item.id} onClick={() => onConcept(item.id)}>
              {item.term}
            </button>
          ))}
        </div>
      )}
      <div className="guided-actions">
        <button
          className="guided-review-toggle"
          aria-pressed={!!cards[id]}
          onClick={() =>
            cards[id]
              ? removeCard(id)
              : addCards([{ slug: data.meta.slug, kind: "concept", refId: concept.id, variant }])
          }
        >
          {cards[id] ? "Concetto nel ripasso ✓" : "Aggiungi al ripasso"}
        </button>
        {concept.definedIn !== open.paragraphId && (
          <button
            className="guided-text-button"
            onClick={() => {
              onClose();
              onParagraph(concept.definedIn);
            }}
          >
            Vai al passaggio che lo introduce →
          </button>
        )}
      </div>
      {elsewhere.length > 0 && (
        <details>
          <summary>Lo stesso concetto in altri paper</summary>
          {elsewhere.map((paper) => (
            <Link
              key={paper.slug}
              to={`/paper/${paper.slug}?view=guide&p=${encodeURIComponent(paper.definedIn)}`}
            >
              {paper.title}
            </Link>
          ))}
        </details>
      )}
    </Popover>
  );
}
