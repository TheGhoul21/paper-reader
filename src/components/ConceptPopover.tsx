import { Link } from "react-router-dom";
import Popover from "./Popover";
import { conceptDefinition } from "../lib/concepts";
import type { Concept, ConceptIndexEntry, Paragraph } from "../types";

interface Props {
  concept: Concept;
  variant: string;
  /** The paragraph where the paper introduces the concept, if it's in paragraphs.json. */
  definedIn: Paragraph | null;
  definedInNumber: number | undefined;
  /** The comment the term was clicked in — no point offering a jump to it. */
  fromParagraphId: string | null;
  related: Concept[];
  /** The same concept (same id) in other papers of the library. */
  elsewhere: ConceptIndexEntry[];
  anchor: { x: number; y: number };
  onGoToParagraph: (paragraph: Paragraph) => void;
  onSelectConcept: (id: string) => void;
  onHighlight: () => void;
  onClose: () => void;
}

/** Glossary card for a concept clicked in an explanation: definition at the reader's level, where the paper introduces it, related concepts. */
export default function ConceptPopover({
  concept,
  variant,
  definedIn,
  definedInNumber,
  fromParagraphId,
  related,
  elsewhere,
  anchor,
  onGoToParagraph,
  onSelectConcept,
  onHighlight,
  onClose,
}: Props) {
  const { text, isFallback } = conceptDefinition(concept, variant);
  return (
    <Popover anchor={anchor} onClose={onClose} className="concept-popover">
      <div className="explanation-section">Glossario</div>
      <p className="concept-term-title">{concept.term}</p>
      {isFallback && <p className="explanation-fallback-note">Non disponibile in questa combinazione — mostrata quella predefinita.</p>}
      <p>{text}</p>
      {related.length > 0 && (
        <div className="concept-related">
          <span className="concept-related-label">Vedi anche</span>
          {related.map((r) => (
            <button key={r.id} className="concept-chip" onClick={() => onSelectConcept(r.id)}>
              {r.term}
            </button>
          ))}
        </div>
      )}
      {elsewhere.length > 0 && (
        <div className="concept-elsewhere">
          <span className="concept-related-label">Anche in</span>
          <ul>
            {elsewhere.map((e) => (
              <li key={e.slug}>
                <Link to={`/paper/${e.slug}?p=${e.definedIn}`} title={e.definition}>
                  {e.title}
                </Link>
                {e.term.toLowerCase() !== concept.term.toLowerCase() && <span className="concept-elsewhere-term"> — “{e.term}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="explanation-ask-row">
        <button
          className="explanation-ask-btn"
          onClick={() => {
            onHighlight();
            onClose();
          }}
        >
          Evidenzia nel PDF
        </button>
        {definedIn &&
          (definedIn.id === fromParagraphId ? (
            <span className="concept-defined-here">Introdotto in questo paragrafo</span>
          ) : (
            <button
              className="explanation-ask-btn"
              onClick={() => {
                onGoToParagraph(definedIn);
                onClose();
              }}
            >
              Introdotto al paragrafo {definedInNumber} · pag. {definedIn.page + 1}
            </button>
          ))}
      </div>
    </Popover>
  );
}
