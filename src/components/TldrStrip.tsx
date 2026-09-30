import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "./icons";
import type { Tldr } from "../types";

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

/**
 * "In breve": a one-line strip under the toolbar with the paper's idea; clicking it drops down
 * the whole plain-language summary over the pages (so opening it doesn't reflow the PDF).
 */
export default function TldrStrip({ tldr }: { tldr: Tldr }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className={`tldr-strip${open ? " is-open" : ""}`}>
      <button className="tldr-strip-bar" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tldr-strip-mark" aria-hidden>✦</span>
        <span className="tldr-strip-label">In breve</span>
        <span className="tldr-strip-idea">{open ? "" : tldr.idea}</span>
        <span className="tldr-strip-toggle">
          {open ? "Chiudi" : "Leggi tutto"}
          <ChevronRightIcon className="tldr-strip-chevron" aria-hidden />
        </span>
      </button>
      {open && (
        <dl className="tldr-panel">
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
    </div>
  );
}
