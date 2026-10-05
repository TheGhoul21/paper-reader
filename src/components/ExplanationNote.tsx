import { lazy, Suspense, useMemo, useState } from "react";
import { segmentText, type ConceptMatcher } from "../lib/concepts";
import type { Paragraph } from "../types";
import type { ParagraphRole } from "../lib/structure";
import { pickVariant } from "../lib/structure";
import type { ReadingContext } from "../lib/readingGuide";
import { ExternalLinkIcon } from "./icons";
import ReadingDiagram from "./ReadingDiagram";

const DeepDive = lazy(() => import("./DeepDive"));

interface Props {
  paperTitle: string;
  paragraph: Paragraph;
  number: number;
  showSection: boolean;
  variant: string;
  active: boolean;
  highlighted: boolean;
  conceptMatcher: ConceptMatcher;
  /** This paragraph's place in the argument map: which claims it states or supports. */
  roles?: ParagraphRole[];
  onRoleClick?: (claimId: string) => void;
  readingContext?: ReadingContext;
  onOpenGuide?: () => void;
  /** Later paragraphs this one sets up ("Servirà più avanti"), resolved with their badge numbers. */
  leadsTo?: { target: Paragraph; number: number; why: Record<string, string> }[];
  /** Whether this paragraph is in the review deck (marked as "to review" by the reader). */
  inReview: boolean;
  onToggleReview: () => void;
  onActivate: () => void;
  onHover: (hovering: boolean) => void;
  onConcept: (conceptId: string, clientPos: { x: number; y: number }) => void;
  onGoToParagraph: (paragraphId: string) => void;
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
  roles,
  onRoleClick,
  readingContext,
  onOpenGuide,
  leadsTo,
  inReview,
  onToggleReview,
  onActivate,
  onHover,
  onConcept,
  onGoToParagraph,
}: Props) {
  const explanation = paragraph.explanations[variant];
  const fallbackKey = Object.keys(paragraph.explanations)[0];
  const shownExplanation = explanation ?? paragraph.explanations[fallbackKey];
  // Same variant as the note, else none: a deep dive in another level would read oddly under this note.
  const deepDive = paragraph.deepDive?.[explanation ? variant : fallbackKey];
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [copied, setCopied] = useState<AskTarget | null>(null);
  const [manualPrompt, setManualPrompt] = useState<string | null>(null);
  const segments = useMemo(
    () => segmentText(shownExplanation, conceptMatcher),
    [shownExplanation, conceptMatcher],
  );

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
      ...(deepDive ? ["", "Approfondimento che ho già:", deepDive] : []),
      "",
      "Puoi aiutarmi ad approfondire o rispondere a domande su questo passaggio?",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(target);
      setManualPrompt(null);
    } catch {
      setCopied(null);
      setManualPrompt(prompt);
    }
  }

  return (
    <div
      id={`note-${paragraph.id}`}
      className={`explanation-note${active ? " is-active" : ""}${highlighted ? " is-highlighted" : ""}${inReview ? " is-in-review" : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      {showSection && paragraph.section && (
        <div className="explanation-section">{paragraph.section}</div>
      )}
      {roles && roles.length > 0 && (
        <div className="note-roles">
          {roles.map((r) => (
            <button
              key={r.claimId}
              className={`note-role note-role-${r.kind}`}
              onClick={(e) => {
                e.stopPropagation();
                onRoleClick?.(r.claimId);
              }}
              title="Mostra nella mappa dell'argomento"
            >
              {r.kind === "stated" ? `Enuncia ${r.label}` : `Prova per ${r.label}`}
            </button>
          ))}
        </div>
      )}
      <div className="explanation-note-body">
        <button
          type="button"
          className="paragraph-badge"
          onClick={onActivate}
          aria-pressed={active}
          aria-label={`Mostra passaggio ${number} nel PDF`}
          title={inReview ? "Da ripassare" : undefined}
        >
          {number}
        </button>
        <div>
          {!explanation && (
            <p className="explanation-fallback-note">
              Non disponibile in questa combinazione — mostrata quella predefinita.
            </p>
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
                    const rect = e.currentTarget.getBoundingClientRect();
                    onConcept(seg.conceptId, { x: rect.left, y: rect.bottom + 8 });
                  }}
                >
                  {seg.text}
                </button>
              ),
            )}
          </p>
          {active && readingContext && (
            <details className="reading-context">
              <summary>Contesto e percorso della sezione</summary>
              <p>{pickVariant(readingContext.step.meaning, variant)}</p>
              {readingContext.step.diagram && (
                <ReadingDiagram diagram={readingContext.step.diagram} variant={variant} />
              )}
              <button
                type="button"
                className="reading-guide-jump"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGuide?.();
                }}
              >
                Il percorso della sezione · {readingContext.stepIndex + 1}/
                {readingContext.section.steps.length} →
              </button>
            </details>
          )}
          {leadsTo && leadsTo.length > 0 && (
            <ForwardLinks links={leadsTo} variant={variant} onGoToParagraph={onGoToParagraph} />
          )}
          {deepDive && (
            <button
              type="button"
              className="deep-dive-toggle"
              aria-expanded={deepDiveOpen}
              onClick={() => setDeepDiveOpen((o) => !o)}
            >
              {deepDiveOpen ? "Chiudi approfondimento ▾" : "Approfondisci ▸"}
            </button>
          )}
          {deepDive && deepDiveOpen && (
            <Suspense fallback={<p className="deep-dive-loading">Caricamento…</p>}>
              <DeepDive markdown={deepDive} onGoToParagraph={onGoToParagraph} />
            </Suspense>
          )}
          {paragraph.notebookSuggestion && (
            <p className="explanation-notebook-hint">💡 {paragraph.notebookSuggestion}</p>
          )}
          {active && paragraph.recall && paragraph.recall.length > 0 && (
            <p className="recall-hint">
              {paragraph.recall.length === 1
                ? "1 domanda di ripasso"
                : `${paragraph.recall.length} domande di ripasso`}{" "}
              su questo paragrafo
            </p>
          )}
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
            <details className="ask-menu">
              <summary>Chiedi un aiuto esterno</summary>
              <p>Copia il passaggio, poi apri la chat e incollalo.</p>
              {(["claude", "chatgpt"] as const).map((target) => (
                <div key={target}>
                  <button className="explanation-ask-btn" onClick={() => handleAsk(target)}>
                    {copied === target
                      ? "Copiato ✓"
                      : `Copia per ${target === "claude" ? "Claude" : "ChatGPT"}`}
                  </button>
                  <a href={ASK_URLS[target]} target="_blank" rel="noopener noreferrer">
                    {ASK_LABELS[target]} <ExternalLinkIcon width={13} height={13} />
                  </a>
                </div>
              ))}
              {manualPrompt && (
                <label className="manual-copy" role="status">
                  Copia automatica non riuscita. Seleziona e copia questo testo:
                  <textarea readOnly value={manualPrompt} onFocus={(e) => e.target.select()} />
                </label>
              )}
            </details>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Servirà più avanti": the later paragraphs this one is setting up, each with what it contributes
 * there. Hovering one previews that paragraph's note; clicking goes to it.
 */
function ForwardLinks({
  links,
  variant,
  onGoToParagraph,
}: {
  links: { target: Paragraph; number: number; why: Record<string, string> }[];
  variant: string;
  onGoToParagraph: (paragraphId: string) => void;
}) {
  const [peek, setPeek] = useState<string | null>(null);
  return (
    <div className="forward-links">
      <div className="forward-links-label">Servirà più avanti</div>
      <ul>
        {links.map(({ target, number, why }) => (
          <li
            key={target.id}
            onMouseEnter={() => setPeek(target.id)}
            onMouseLeave={() => setPeek(null)}
          >
            <button
              type="button"
              className="forward-link"
              onClick={(e) => {
                e.stopPropagation();
                onGoToParagraph(target.id);
              }}
              onFocus={() => setPeek(target.id)}
              onBlur={() => setPeek(null)}
            >
              <span className="paragraph-badge">{number}</span>
              <span>{why[variant] ?? Object.values(why)[0]}</span>
            </button>
            {peek === target.id && (
              <div className="forward-link-preview" role="tooltip">
                <div className="forward-link-preview-head">
                  Paragrafo {number}
                  {target.section && <> · {target.section}</>}
                </div>
                <p>{target.explanations[variant] ?? Object.values(target.explanations)[0]}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
