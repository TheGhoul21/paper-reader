import { useState } from "react";
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
  onActivate: () => void;
  onHover: (hovering: boolean) => void;
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
  onActivate,
  onHover,
}: Props) {
  const explanation = paragraph.explanations[variant];
  const fallbackKey = Object.keys(paragraph.explanations)[0];
  const shownExplanation = explanation ?? paragraph.explanations[fallbackKey];
  const [copied, setCopied] = useState<AskTarget | null>(null);

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
      className={`explanation-note${active ? " is-active" : ""}${highlighted ? " is-highlighted" : ""}`}
      onClick={onActivate}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {showSection && paragraph.section && <div className="explanation-section">{paragraph.section}</div>}
      <div className="explanation-note-body">
        <span className="paragraph-badge" aria-label={`Paragrafo ${number}`}>
          {number}
        </span>
        <div>
          {!explanation && (
            <p className="explanation-fallback-note">Non disponibile in questa combinazione — mostrata quella predefinita.</p>
          )}
          <p>{shownExplanation}</p>
          {paragraph.notebookSuggestion && <p className="explanation-notebook-hint">💡 {paragraph.notebookSuggestion}</p>}
        </div>
      </div>
      {active && (
        <>
          <div className="explanation-ask-row">
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
