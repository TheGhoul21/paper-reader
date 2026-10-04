import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Logo from "../Logo";
import type { PaperData } from "../../lib/papers";
import type { GuidedStop } from "../../lib/guidedReading";
import { explainedPageCount } from "../../lib/guidedReading";
import { pickVariant } from "../../lib/structure";
import type { Variant } from "../../types";
import { useReaderPreferences } from "../../lib/readingProgress";

const LEVELS: Record<Variant["level"], string> = {
  beginner: "Da zero",
  intermediate: "Con le basi",
  expert: "Esperto",
};
const STAGES = [
  { key: "overview", label: "Orientati" },
  { key: "read", label: "Segui il ragionamento" },
  { key: "summary", label: "Sintesi" },
] as const;

export function ReadingHeader({
  data,
  variant,
  stage,
  libraryUrl,
  pdfUrl,
  onVariant,
  onOverview,
  onRead,
  onSummary,
  onSource,
}: {
  data: PaperData;
  variant: string;
  stage: string;
  libraryUrl: string;
  pdfUrl: string;
  onVariant: (key: string) => void;
  onOverview: () => void;
  onRead: () => void;
  onSummary: () => void;
  onSource: () => void;
}) {
  const languages = new Set(data.meta.variants.map((v) => v.language));
  const preferences = useReaderPreferences();
  const location = useLocation();
  const optionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      const options = optionsRef.current;
      if (event.key === "Escape" && options?.open && options.contains(document.activeElement)) {
        options.open = false;
        options.querySelector("summary")?.focus();
      }
    }
    function closeOutside(event: PointerEvent) {
      const options = optionsRef.current;
      if (options?.open && !options.contains(event.target as Node)) options.open = false;
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);
  const actions = { overview: onOverview, read: onRead, summary: onSummary };
  return (
    <header className="guided-header">
      <Link to={libraryUrl} className="guided-brand" aria-label="Torna alla libreria">
        <Logo />
        <span>paper reader</span>
      </Link>
      <nav aria-label="Momenti della lettura">
        {STAGES.map((item, index) => (
          <button
            key={item.key}
            aria-current={stage === item.key ? "step" : undefined}
            onClick={actions[item.key]}
          >
            <span>{index + 1}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <label className="guided-level">
        <span>Spiegazioni</span>
        <select
          aria-label="Livello di spiegazione"
          value={variant}
          onChange={(e) => onVariant(e.target.value)}
        >
          {data.meta.variants.map((item) => (
            <option key={item.key} value={item.key}>
              {languages.size > 1 ? `${item.language.toUpperCase()} · ` : ""}
              {LEVELS[item.level]}
            </option>
          ))}
        </select>
      </label>
      <details className="guided-options" ref={optionsRef}>
        <summary>PDF e testo</summary>
        <div>
          <Link to={pdfUrl} state={location.state} onClick={onSource}>
            Apri il lettore PDF ↗
          </Link>
          <label>
            Dimensione testo spiegazioni
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={preferences.fontSize}
              onChange={(e) => preferences.setFontSize(Number(e.target.value))}
            />
            <span>{preferences.fontSize} px</span>
          </label>
          <Link to="/review">Ripasso e backup →</Link>
        </div>
      </details>
      <Link to={pdfUrl} state={location.state} onClick={onSource} className="guided-source-link">
        Lettore PDF ↗
      </Link>
    </header>
  );
}

export function ReadingRoute({
  stops,
  variant,
  currentId,
  explored,
  doubts,
  onOpen,
  compact = false,
}: {
  stops: GuidedStop[];
  variant: string;
  currentId?: string;
  explored: Set<string>;
  doubts: Set<string>;
  onOpen: (index: number) => void;
  compact?: boolean;
}) {
  const sections = [...new Map(stops.map((stop) => [stop.section.id, stop.section])).values()];
  return (
    <ol className={`guided-chapters${compact ? " is-compact" : ""}`}>
      {sections.map((section, i) => {
        const index = stops.findIndex((stop) => stop.section.id === section.id);
        const active = stops.find((stop) => stop.step.id === currentId)?.section.id === section.id;
        const hasDoubt = section.steps.some((step) => doubts.has(step.id));
        const complete = section.steps.every((step) => explored.has(step.id));
        return (
          <li key={section.id}>
            <button onClick={() => onOpen(index)} aria-current={active ? "step" : undefined}>
              <span className="guided-chapter-number">
                {hasDoubt ? "?" : complete ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{pickVariant(section.title, variant)}</strong>
                {!compact && <small>{pickVariant(section.goal, variant)}</small>}
                {hasDoubt && <small>Contiene tappe da rivedere</small>}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ReadingCoverage({ data }: { data: PaperData }) {
  const pages = explainedPageCount(data.paragraphs);
  return (
    <p className="guided-coverage">
      Passaggi spiegati su {pages} pagine dell'originale ({data.meta.pageCount} pagine totali).{" "}
      {pages < data.meta.pageCount && "Il percorso segue i passaggi disponibili."}
    </p>
  );
}
