import { useState } from "react";
import { pickVariant } from "../lib/structure";
import type { ReadingSection } from "../types";
import ReadingDiagram from "./ReadingDiagram";

interface Props {
  sections: ReadingSection[];
  variant: string;
  activeId: string | null;
  numbers: Map<string, number>;
  onGoToParagraph: (paragraphId: string) => void;
}

/** A section's route through the argument, grounded in the actual objects being discussed. */
export default function ReadingGuide({
  sections,
  variant,
  activeId,
  numbers,
  onGoToParagraph,
}: Props) {
  const [selection, setSelection] = useState<{
    sectionId: string;
    paragraphId: string | null;
  } | null>(null);
  const activeSection = sections.find((s) =>
    s.steps.some((step) => activeId !== null && step.paragraphs.includes(activeId)),
  );
  const manualSection =
    selection?.paragraphId === activeId
      ? sections.find((s) => s.id === selection.sectionId)
      : undefined;
  const selectedSection = manualSection ?? activeSection ?? sections[0];
  if (!selectedSection) return null;
  return (
    <div className="reading-guide">
      {sections.length > 1 && (
        <label className="reading-guide-picker">
          <span>Sezione della guida</span>
          <select
            value={selectedSection.id}
            onChange={(e) => setSelection({ sectionId: e.target.value, paragraphId: activeId })}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {pickVariant(s.title, variant)}
              </option>
            ))}
          </select>
        </label>
      )}
      {[selectedSection].map((section) => (
        <section
          key={section.id}
          className="reading-guide-section"
          aria-label={pickVariant(section.title, variant)}
        >
          <h2>{pickVariant(section.title, variant)}</h2>
          <div className="reading-guide-goal">
            <div className="reading-context-label">Obiettivo della sezione</div>
            <p>{pickVariant(section.goal, variant)}</p>
          </div>
          <ol className="reading-guide-steps">
            {section.steps.map((step, i) => {
              const current = activeId !== null && step.paragraphs.includes(activeId);
              const first = step.paragraphs.find((id) => numbers.has(id));
              const last = [...step.paragraphs].reverse().find((id) => numbers.has(id));
              return (
                <li
                  key={step.id}
                  className={current ? "is-current" : undefined}
                  aria-current={current ? "step" : undefined}
                >
                  <div className="reading-guide-step-head">
                    <span className="reading-guide-step-number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3>{pickVariant(step.title, variant)}</h3>
                    {current && <span className="reading-guide-current">Sei qui</span>}
                  </div>
                  <details className="reading-guide-meaning">
                    <summary>Contesto</summary>
                    <p>{pickVariant(step.meaning, variant)}</p>
                    {step.diagram && <ReadingDiagram diagram={step.diagram} variant={variant} />}
                  </details>
                  {first && (
                    <button className="reading-guide-jump" onClick={() => onGoToParagraph(first)}>
                      Leggi{" "}
                      {first === last
                        ? `il paragrafo ${numbers.get(first)}`
                        : `i paragrafi ${numbers.get(first)}–${numbers.get(last!)}`}{" "}
                      →
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {section.leadsTo && numbers.has(section.leadsTo.paragraphId) && (
            <div className="reading-guide-next">
              <div className="reading-context-label">Sezione successiva</div>
              <p>{pickVariant(section.leadsTo.why, variant)}</p>
              <button
                className="reading-guide-jump"
                onClick={() => onGoToParagraph(section.leadsTo!.paragraphId)}
              >
                Vai al paragrafo {numbers.get(section.leadsTo.paragraphId)} →
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
