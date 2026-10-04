import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AnnotationTool, Variant } from "../types";
import type { usePdfViewport } from "../lib/usePdfViewport";
import type { usePdfSearch } from "../lib/usePdfSearch";
import type { useReaderPreferences } from "../lib/readingProgress";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CommentsIcon,
  LibraryIcon,
  SearchIcon,
} from "./icons";

interface Props {
  paper: { title: string; authors: string[]; pdfUrl: string };
  viewport: ReturnType<typeof usePdfViewport>;
  pageCount: number;
  search: ReturnType<typeof usePdfSearch>;
  tools: {
    tool: AnnotationTool;
    color: string;
    setTool: (tool: AnnotationTool) => void;
    setColor: (color: string) => void;
  };
  variants: Variant[];
  variant: string;
  onVariantChange: (key: string) => void;
  panel: { open: boolean; toggle: () => void };
  preferences: ReturnType<typeof useReaderPreferences>;
  thread?: { on: boolean; onToggle: () => void };
  onBack?: () => void;
}
const LEVEL_NAMES = { beginner: "Base", intermediate: "Intermedio", expert: "Esperto" };
const COLORS = [
  { color: "#e8916a", name: "Arancio" },
  { color: "#f2c14e", name: "Giallo" },
  { color: "#6fa8dc", name: "Blu" },
  { color: "#93c47d", name: "Verde" },
  { color: "#c27ba0", name: "Viola" },
];

export default function Toolbar({
  paper,
  viewport,
  pageCount,
  search,
  tools,
  variants,
  variant,
  onVariantChange,
  panel,
  preferences,
  thread,
  onBack,
}: Props) {
  const location = useLocation();
  const showLanguage = new Set(variants.map((item) => item.language)).size > 1;
  const librarySearch: unknown = location.state?.librarySearch;
  const libraryUrl =
    typeof librarySearch === "string" && librarySearch ? `/?${librarySearch}` : "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState(String(viewport.currentPage));
  const [pageError, setPageError] = useState("");
  const pageEditing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pageEditing.current) setPageDraft(String(viewport.currentPage));
  }, [viewport.currentPage]);
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);
  function commitPage() {
    pageEditing.current = false;
    const page = Number(pageDraft);
    if (!pageDraft.trim() || !Number.isInteger(page) || page < 1 || page > pageCount) {
      setPageError(`Inserisci una pagina da 1 a ${pageCount}.`);
      setPageDraft(String(viewport.currentPage));
      return;
    }
    setPageError("");
    viewport.jumpToPage(page);
  }
  function closeSearch() {
    setSearchOpen(false);
    search.setQuery("");
    requestAnimationFrame(() => searchButton.current?.focus());
  }
  return (
    <div className="toolbar">
      <Link to={libraryUrl} className="toolbar-icon-btn" aria-label="Torna alla libreria">
        <LibraryIcon />
      </Link>
      <span className="toolbar-title" title={`${paper.title} — ${paper.authors.join(", ")}`}>
        {paper.title}
      </span>
      <div className="toolbar-cluster toolbar-pages">
        <button
          className="toolbar-icon-btn"
          disabled={viewport.currentPage <= 1}
          onClick={() => viewport.jumpToPage(viewport.currentPage - 1)}
          aria-label="Pagina precedente"
        >
          <ChevronLeftIcon />
        </button>
        <input
          className="toolbar-page-input"
          aria-label="Pagina del PDF"
          aria-invalid={!!pageError}
          aria-describedby={pageError ? "page-error" : undefined}
          type="text"
          inputMode="numeric"
          value={pageDraft}
          onFocus={() => {
            pageEditing.current = true;
          }}
          onChange={(e) => {
            pageEditing.current = true;
            setPageDraft(e.target.value);
            setPageError("");
          }}
          onBlur={commitPage}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setPageDraft(String(viewport.currentPage));
              pageEditing.current = false;
            }
          }}
        />
        <span className="toolbar-page-total">/ {pageCount}</span>
        <button
          className="toolbar-icon-btn"
          disabled={viewport.currentPage >= pageCount}
          onClick={() => viewport.jumpToPage(viewport.currentPage + 1)}
          aria-label="Pagina successiva"
        >
          <ChevronRightIcon />
        </button>
      </div>
      {pageError && (
        <span id="page-error" className="toolbar-validation" role="alert">
          {pageError}
        </span>
      )}
      <button
        ref={searchButton}
        className="toolbar-icon-btn toolbar-search-toggle"
        aria-label="Cerca nel PDF"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen((open) => !open)}
      >
        <SearchIcon />
      </button>
      <label className="toolbar-variant">
        <span className="sr-only">Livello di spiegazione</span>
        <select value={variant} onChange={(e) => onVariantChange(e.target.value)}>
          {variants.map((v) => (
            <option key={v.key} value={v.key}>
              {showLanguage && `${v.language === "it" ? "Italiano" : v.language.toUpperCase()} · `}
              {LEVEL_NAMES[v.level]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="toolbar-text-btn"
        aria-label="Spiegazioni"
        aria-expanded={panel.open}
        onClick={panel.toggle}
      >
        <CommentsIcon aria-hidden="true" />
        <span className="toolbar-panel-label">Spiegazioni</span>
      </button>
      <details className="toolbar-menu">
        <summary>Strumenti</summary>
        <div className="toolbar-menu-body">
          <fieldset>
            <legend>Vista PDF</legend>
            <div className="toolbar-menu-row">
              <button onClick={() => viewport.zoom(-0.1)} aria-label="Riduci zoom">
                −
              </button>
              <span>{Math.round((viewport.scale / 1.5) * 100)}%</span>
              <button onClick={() => viewport.zoom(0.1)} aria-label="Aumenta zoom">
                +
              </button>
            </div>
            <button
              aria-pressed={viewport.fitMode === "width"}
              onClick={() => viewport.setFitMode("width")}
            >
              Adatta larghezza
            </button>
            <button
              aria-pressed={viewport.fitMode === "page"}
              onClick={() => viewport.setFitMode("page")}
            >
              Adatta pagina
            </button>
          </fieldset>
          <fieldset>
            <legend>Le mie note</legend>
            <div className="toolbar-menu-row">
              {(
                [
                  { key: "none", label: "Leggi" },
                  { key: "text", label: "Nota" },
                  { key: "draw", label: "Disegna" },
                  { key: "erase", label: "Gomma" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  aria-pressed={tools.tool === t.key}
                  onClick={() => tools.setTool(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="toolbar-swatches" role="group" aria-label="Colore delle mie note">
              {COLORS.map((c) => (
                <button
                  key={c.color}
                  className={`toolbar-swatch${tools.color === c.color ? " is-active" : ""}`}
                  style={{ backgroundColor: c.color }}
                  aria-label={c.name}
                  aria-pressed={tools.color === c.color}
                  onClick={() => tools.setColor(c.color)}
                />
              ))}
            </div>
            <small>Le note si salvano mentre scrivi. Usa Fine per chiudere l'editor.</small>
          </fieldset>
          <fieldset>
            <legend>Lettura</legend>
            <label>
              Testo spiegazioni{" "}
              <input
                aria-label="Dimensione testo spiegazioni"
                type="range"
                min={14}
                max={24}
                value={preferences.fontSize}
                onChange={(e) => preferences.setFontSize(Number(e.target.value))}
              />
              {preferences.fontSize} px
            </label>
            <label className="panel-width-control">
              Larghezza pannello{" "}
              <input
                aria-label="Larghezza pannello spiegazioni"
                type="range"
                min={320}
                max={600}
                step={20}
                value={preferences.panelWidth}
                onChange={(e) => preferences.setPanelWidth(Number(e.target.value))}
              />
            </label>
            {thread && (
              <button aria-pressed={thread.on} onClick={thread.onToggle}>
                {thread.on ? "Mostra tutti i passaggi" : "Mostra solo il filo della mappa"}
              </button>
            )}
            <button disabled={!onBack} onClick={onBack}>
              Torna al passaggio precedente
            </button>
          </fieldset>
          <a href={paper.pdfUrl} download>
            Scarica PDF
          </a>
        </div>
      </details>
      {tools.tool !== "none" && (
        <span className="toolbar-tool-state" role="status">
          {tools.tool === "text" ? "Nota" : tools.tool === "draw" ? "Disegno" : "Gomma"}
          <button onClick={() => tools.setTool("none")} aria-label="Torna alla lettura">
            ×
          </button>
        </span>
      )}
      {searchOpen && (
        <div className="toolbar-search-row">
          <input
            ref={input}
            className="toolbar-search-input"
            aria-label="Testo da cercare nel PDF"
            placeholder="Cerca nel PDF…"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search.move(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") closeSearch();
            }}
          />
          <span className="toolbar-search-count" role="status">
            {search.status === "loading"
              ? "Ricerca…"
              : search.status === "error"
                ? "Ricerca non riuscita"
                : search.query
                  ? search.count
                    ? `${search.index + 1}/${search.count}`
                    : "Nessun risultato"
                  : ""}
          </span>
          {search.status === "error" && <button onClick={search.retry}>Riprova</button>}
          <button
            className="toolbar-icon-btn"
            disabled={!search.count}
            onClick={() => search.move(-1)}
            aria-label="Risultato precedente"
          >
            <ChevronLeftIcon />
          </button>
          <button
            className="toolbar-icon-btn"
            disabled={!search.count}
            onClick={() => search.move(1)}
            aria-label="Risultato successivo"
          >
            <ChevronRightIcon />
          </button>
          <button className="toolbar-icon-btn" onClick={closeSearch} aria-label="Chiudi ricerca">
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
