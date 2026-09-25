import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AnnotationTool, Variant } from "../types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CommentsIcon,
  CursorIcon,
  DownloadIcon,
  EraserIcon,
  FitPageIcon,
  FitWidthIcon,
  LayersIcon,
  LibraryIcon,
  MinusIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "./icons";

export type FitMode = "none" | "width" | "page";

interface Props {
  title: string;
  authors: string[];
  pdfUrl: string;
  scale: number;
  onZoom: (delta: number) => void;
  fitMode: FitMode;
  onFit: (mode: FitMode) => void;
  currentPage: number;
  numPages: number;
  onJumpToPage: (page: number) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchMatchCount: number;
  searchMatchIndex: number;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  variants: Variant[];
  variant: string;
  onVariantChange: (key: string) => void;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

const COLORS = ["#e8916a", "#f2c14e", "#6fa8dc", "#93c47d", "#c27ba0"];

export default function Toolbar({
  title,
  authors,
  pdfUrl,
  scale,
  onZoom,
  fitMode,
  onFit,
  currentPage,
  numPages,
  onJumpToPage,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  searchMatchIndex,
  onSearchNext,
  onSearchPrev,
  tool,
  onToolChange,
  color,
  onColorChange,
  variants,
  variant,
  onVariantChange,
  notesOpen,
  onToggleNotes,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    onSearchQueryChange("");
  }

  return (
    <div className="toolbar">
      <Link to="/" className="toolbar-icon-btn toolbar-home" aria-label="Torna alla libreria" title="Torna alla libreria">
        <LibraryIcon />
      </Link>
      <div className="toolbar-title toolbar-optional" title={authors.length ? `${title} — ${authors.join(", ")}` : title}>
        {title}
      </div>

      {!searchOpen ? (
        <>
          <div className="toolbar-cluster">
            <button className="toolbar-icon-btn" onClick={() => onJumpToPage(currentPage - 1)} aria-label="Pagina precedente">
              <ChevronLeftIcon />
            </button>
            <input
              className="toolbar-page-input"
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onJumpToPage(n);
              }}
            />
            <span className="toolbar-page-total">/ {numPages}</span>
            <button className="toolbar-icon-btn" onClick={() => onJumpToPage(currentPage + 1)} aria-label="Pagina successiva">
              <ChevronRightIcon />
            </button>
          </div>

          <div className="toolbar-sep toolbar-optional" />

          <div className="toolbar-cluster toolbar-optional">
            <button className="toolbar-icon-btn" onClick={() => onZoom(-0.1)} aria-label="Riduci zoom">
              <MinusIcon />
            </button>
            <span className="toolbar-zoom-value">{Math.round((scale * 100) / 1.5)}%</span>
            <button className="toolbar-icon-btn" onClick={() => onZoom(0.1)} aria-label="Aumenta zoom">
              <PlusIcon />
            </button>
          </div>

          <div className="toolbar-sep toolbar-optional" />

          <div className="toolbar-cluster">
            <button
              className={`toolbar-icon-btn toolbar-optional${fitMode === "width" ? " is-active" : ""}`}
              onClick={() => onFit(fitMode === "width" ? "none" : "width")}
              aria-label="Adatta larghezza"
              title="Adatta larghezza"
            >
              <FitWidthIcon />
            </button>
            <button
              className={`toolbar-icon-btn toolbar-optional${fitMode === "page" ? " is-active" : ""}`}
              onClick={() => onFit(fitMode === "page" ? "none" : "page")}
              aria-label="Adatta pagina"
              title="Adatta pagina"
            >
              <FitPageIcon />
            </button>
            <button className="toolbar-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Cerca" title="Cerca">
              <SearchIcon />
            </button>
          </div>
        </>
      ) : (
        <div className="toolbar-cluster toolbar-search-open">
          <SearchIcon className="toolbar-search-icon" />
          <input
            ref={searchInputRef}
            className="toolbar-search-input"
            type="text"
            placeholder="Cerca nel testo…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.shiftKey ? onSearchPrev : onSearchNext)();
              if (e.key === "Escape") closeSearch();
            }}
          />
          {searchQuery && (
            <span className="toolbar-search-count">{searchMatchCount > 0 ? `${searchMatchIndex + 1}/${searchMatchCount}` : "0"}</span>
          )}
          <button className="toolbar-icon-btn" onClick={onSearchPrev} disabled={searchMatchCount === 0} aria-label="Risultato precedente">
            <ChevronLeftIcon />
          </button>
          <button className="toolbar-icon-btn" onClick={onSearchNext} disabled={searchMatchCount === 0} aria-label="Risultato successivo">
            <ChevronRightIcon />
          </button>
          <button className="toolbar-icon-btn" onClick={closeSearch} aria-label="Chiudi ricerca">
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="toolbar-right">
        <div className="toolbar-cluster toolbar-optional">
          {(["none", "text", "draw", "erase"] as const).map((t) => (
            <button
              key={t}
              className={`toolbar-icon-btn${tool === t ? " is-active" : ""}`}
              onClick={() => onToolChange(t)}
              aria-label={t === "none" ? "Cursore" : t === "text" ? "Nota di testo" : t === "draw" ? "Disegno libero" : "Cancella annotazione"}
              title={t === "none" ? "Cursore" : t === "text" ? "Nota" : t === "draw" ? "Disegna" : "Cancella"}
            >
              {t === "none" && <CursorIcon />}
              {t === "text" && <NoteIcon />}
              {t === "draw" && <PencilIcon />}
              {t === "erase" && <EraserIcon />}
            </button>
          ))}
          {(tool === "text" || tool === "draw") && (
            <span className="toolbar-swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`toolbar-swatch${color === c ? " is-active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => onColorChange(c)}
                  aria-label={`Colore ${c}`}
                />
              ))}
            </span>
          )}
        </div>

        <div className="toolbar-sep toolbar-optional" />

        <button
          className={`toolbar-icon-btn${notesOpen ? " is-active" : ""}`}
          onClick={onToggleNotes}
          aria-label={notesOpen ? "Nascondi commenti" : "Mostra commenti"}
          title={notesOpen ? "Nascondi commenti" : "Mostra commenti"}
        >
          <CommentsIcon />
        </button>
        <label className="toolbar-variant">
          <LayersIcon />
          <select value={variant} onChange={(e) => onVariantChange(e.target.value)} aria-label="Livello di spiegazione">
            {variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <a className="toolbar-icon-btn toolbar-optional" href={pdfUrl} download aria-label="Scarica PDF" title="Scarica PDF">
          <DownloadIcon />
        </a>
      </div>
    </div>
  );
}
