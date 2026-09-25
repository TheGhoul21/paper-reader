import { useMemo, useState } from "react";
import { segmentText, type ConceptMatcher } from "../lib/concepts";
import type { Paragraph } from "../types";
import { ExternalLinkIcon } from "./icons";

interface Props {
  paperTitle: string;
  paragraph: Paragraph;
  number: number;
  showSection: boolean;
  variant: string;
  active: boolean;
  highlighted: boolean;
  conceptMatcher: ConceptMatcher;
  /** Whether this paragraph is in the review deck (marked as "to review" by the reader). */
  inReview: boolean;
  onToggleReview: () => void;
  onActivate: () => void;
  onHover: (hovering: boolean) => void;
  onConcept: (conceptId: string, clientPos: { x: number; y: number }) => void;
}

type AskTarget = "claude" | "chatgpt";

const ASK_URLS: Record<AskTarget, string> = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
};

const ASK_LABELS: Record<AskTarget, string> = {
  claude: "Chiedi a Claude",
  chatgpt: "Chiedi a ChatGPT",
};

/** One margin comment in the notes column, tied to its paragraph by `number` (same badge as on the PDF). */
export default function ExplanationNote({
  paperTitle,
  paragraph,
  number,
  showSection,
  variant,
  active,
  highlighted,
  conceptMatcher,
  inReview,
  onToggleReview,
  onActivate,
  onHover,
  onConcept,
}: Props) {
  const explanation = paragraph.explanations[variant];
  const fallbackKey = Object.keys(paragraph.explanations)[0];
  const shownExplanation = explanation ?? paragraph.explanations[fallbackKey];
  const [copied, setCopied] = useState<AskTarget | null>(null);
  const segments = useMemo(() => segmentText(shownExplanation, conceptMatcher), [shownExplanation, conceptMatcher]);

  async function handleAsk(target: AskTarget) {
    const sectionLine = paragraph.section ? ` (sezione "${paragraph.section}")` : "";
    const prompt = [
      `Sto leggendo il paper "${paperTitle}"${sectionLine} e ho bisogno di aiuto a capire questo passaggio.`,
      "",
      "Testo originale:",
      paragraph.sourceText,
      "",
      "Spiegazione che ho già:",
      shownExplanation,
      "",
      "Puoi aiutarmi ad approfondire o rispondere a domande su questo passaggio?",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard permission denied — the tab still opens, the user can copy the text manually.
    }
    window.open(ASK_URLS[target], "_blank", "noopener,noreferrer");
    setCopied(target);
    window.setTimeout(() => setCopied((c) => (c === target ? null : c)), 2000);
  }

  return (
    <div
      id={`note-${paragraph.id}`}
      className={`explanation-note${active ? " is-active" : ""}${highlighted ? " is-highlighted" : ""}${inReview ? " is-in-review" : ""}`}
      onClick={onActivate}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {showSection && paragraph.section && <div className="explanation-section">{paragraph.section}</div>}
      <div className="explanation-note-body">
        <span className="paragraph-badge" aria-label={`Paragrafo ${number}`} title={inReview ? "Da ripassare" : undefined}>
          {number}
        </span>
        <div>
          {!explanation && (
            <p className="explanation-fallback-note">Non disponibile in questa combinazione — mostrata quella predefinita.</p>
          )}
          <p>
            {segments.map((seg, i) =>
              typeof seg === "string" ? (
                seg
              ) : (
                <button
                  key={i}
                  type="button"
                  className="concept-term"
                  onClick={(e) => {
                    // Not onActivate: that scrolls the PDF pane, and the popover closes on scroll.
                    e.stopPropagation();
                    onConcept(seg.conceptId, { x: e.clientX, y: e.clientY + 12 });
                  }}
                >
                  {seg.text}
                </button>
              ),
            )}
          </p>
          {paragraph.notebookSuggestion && <p className="explanation-notebook-hint">💡 {paragraph.notebookSuggestion}</p>}
        </div>
      </div>
      {active && (
        <>
          <div className="explanation-ask-row">
            <button
              className={`explanation-ask-btn review-toggle${inReview ? " is-on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleReview();
              }}
              aria-pressed={inReview}
              title="Aggiunge questo paragrafo al ripasso: te lo richiederò finché non lo ricordi"
            >
              {inReview ? "Da ripassare ✓" : "Da ripassare"}
            </button>
            {(["claude", "chatgpt"] as const).map((target) => (
              <button key={target} className="explanation-ask-btn" onClick={() => handleAsk(target)}>
                {copied === target ? "Copiato ✓" : ASK_LABELS[target]}
                <ExternalLinkIcon width={13} height={13} />
              </button>
            ))}
          </div>
          <p className="explanation-ask-hint">Il testo del passaggio viene copiato negli appunti: incollalo nella chat che si apre.</p>
        </>
      )}
    </div>
  );
}
