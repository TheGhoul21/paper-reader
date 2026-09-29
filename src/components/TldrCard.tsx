import { useState } from "react";
import type { Tldr } from "../types";

const COLLAPSED_KEY = "paper-reader:tldr-collapsed";

/** The summary in the given language, else the first available (like explanations' variant fallback). */
export function pickTldr(tldr: Record<string, Tldr> | undefined, language: string | undefined): Tldr | null {
  if (!tldr) return null;
  return (language ? tldr[language] : undefined) ?? Object.values(tldr)[0] ?? null;
}

const FIELDS: [keyof Tldr, string][] = [
  ["problem", "Il problema"],
  ["idea", "L'idea"],
  ["result", "Il risultato"],
  ["why", "Perché conta"],
];

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** "In breve": the whole paper in plain words, at the top of the notes pane. Collapsing it is remembered library-wide. */
export default function TldrCard({ tldr }: { tldr: Tldr }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        // storage unavailable: the choice just isn't remembered
      }
      return !c;
    });
  };

  return (
    <section className={`tldr-card${collapsed ? " is-collapsed" : ""}`}>
      <button className="tldr-head" onClick={toggle} aria-expanded={!collapsed}>
        <span className="explanation-section">In breve</span>
        <span className="tldr-chevron" aria-hidden>{collapsed ? "▸" : "▾"}</span>
      </button>
      {collapsed ? (
        <p className="tldr-teaser">{tldr.idea}</p>
      ) : (
        <dl className="tldr-fields">
          {FIELDS.map(([key, label]) =>
            tldr[key] ? (
              <div key={key} className="tldr-field">
                <dt>{label}</dt>
                <dd>{tldr[key]}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
    </section>
  );
}
