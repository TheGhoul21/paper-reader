import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";

interface Props {
  term: string;
  /** null while occurrences are still being counted. */
  count: number | null;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** Floating bar over the PDF while a glossary concept is highlighted in it: occurrence count and navigation. */
export default function ConceptHighlightBar({ term, count, index, onPrev, onNext, onClose }: Props) {
  return (
    <div className="concept-highlight-bar" role="status">
      <mark className="concept-highlight-swatch">{term}</mark>
      <span className="concept-highlight-count">
        {count === null ? "…" : count === 0 ? "nessuna occorrenza nel PDF" : `${index + 1}/${count}`}
      </span>
      <button className="concept-highlight-btn" onClick={onPrev} disabled={!count} aria-label="Occorrenza precedente">
        <ChevronLeftIcon width={16} height={16} />
      </button>
      <button className="concept-highlight-btn" onClick={onNext} disabled={!count} aria-label="Occorrenza successiva">
        <ChevronRightIcon width={16} height={16} />
      </button>
      <button className="concept-highlight-btn" onClick={onClose} aria-label="Togli evidenziazione">
        <CloseIcon width={14} height={14} />
      </button>
    </div>
  );
}
