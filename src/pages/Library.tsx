import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PaperThumbnail from "../components/PaperThumbnail";
import { pickTldr } from "../components/TldrCard";
import { SearchIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { LibraryEntry, Variant } from "../types";
import { papersUrl } from "../lib/paths";
import { useDueCount } from "../lib/review";

const PAGE_SIZE = 6;

const LEVEL_LABELS: Record<Variant["level"], string> = {
  beginner: "Base",
  intermediate: "Intermedio",
  expert: "Esperto",
};

const LEVEL_ORDER: Variant["level"][] = ["beginner", "intermediate", "expert"];

type SortKey = "recent" | "title" | "pages";

const SORTERS: Record<SortKey, (a: LibraryEntry, b: LibraryEntry) => number> = {
  recent: (a, b) => b.importedAt.localeCompare(a.importedAt),
  title: (a, b) => a.title.localeCompare(b.title, "it", { sensitivity: "base" }),
  pages: (a, b) => a.pageCount - b.pageCount,
};

let languageDisplay: Intl.DisplayNames | null;
try {
  languageDisplay = new Intl.DisplayNames(["it"], { type: "language" });
} catch {
  languageDisplay = null;
}

function languageLabel(code: string): string {
  const name = languageDisplay?.of(code);
  if (!name) return code.toUpperCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatAuthors(authors: string[]): string {
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

/** Problem + idea from the paper's plain-language summary: enough to choose what to read. */
function tldrTeaser(p: LibraryEntry): string {
  const tldr = pickTldr(p.tldr, p.language);
  return tldr ? `${tldr.problem} ${tldr.idea}` : "";
}

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : dateFormatter.format(d);
}

export default function Library() {
  const [papers, setPapers] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string>("all");
  const [level, setLevel] = useState<Variant["level"] | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const dueCount = useDueCount();

  useEffect(() => {
    fetch(papersUrl("index.json"))
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setPapers)
      .catch((err) => setError(String(err)));
  }, []);

  const languages = useMemo(() => {
    if (!papers) return [];
    return Array.from(new Set(papers.map((p) => p.language))).sort();
  }, [papers]);

  const levelsPresent = useMemo(() => {
    if (!papers) return [];
    const present = new Set<Variant["level"]>();
    for (const p of papers) for (const v of p.variants) present.add(v.level);
    return LEVEL_ORDER.filter((l) => present.has(l));
  }, [papers]);

  const filtered = useMemo(() => {
    if (!papers) return [];
    const q = query.trim().toLowerCase();
    return papers.filter((p) => {
      if (language !== "all" && p.language !== language) return false;
      if (level !== "all" && !p.variants.some((v) => v.level === level)) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.authors.some((a) => a.toLowerCase().includes(q));
    });
  }, [papers, query, language, level]);

  const sorted = useMemo(() => [...filtered].sort(SORTERS[sortBy]), [filtered, sortBy]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, language, level, sortBy]);

  if (error) return <p className="state-message">Impossibile caricare la libreria: {error}</p>;
  if (!papers) return <p className="state-message">Caricamento…</p>;
  if (papers.length === 0) {
    return (
      <p className="state-message">
        Nessun paper importato. Usa la skill <code>import-paper</code> per aggiungerne uno.
      </p>
    );
  }

  return (
    <div className="library">
      <div className="library-hero">
        <h1 className="library-hero-title">La tua libreria</h1>
        <p className="library-hero-count">
          {papers.length} paper importat{papers.length === 1 ? "o" : "i"}
        </p>
      </div>

      {dueCount > 0 && (
        <Link to="/review" className="review-banner">
          <strong>{dueCount}</strong> da ripassare oggi <span aria-hidden>→</span>
        </Link>
      )}

      <div className="library-controls">
        <div className="library-search">
          <SearchIcon className="library-search-icon" />
          <input
            type="text"
            className="library-search-input"
            placeholder="Cerca per titolo o autore…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="library-search-clear" onClick={() => setQuery("")} aria-label="Cancella ricerca">
              <CloseIcon width={14} height={14} />
            </button>
          )}
        </div>

        <div className="library-filters">
          {languages.length > 1 && (
            <select className="library-select" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Filtra per lingua">
              <option value="all">Tutte le lingue</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {languageLabel(l)}
                </option>
              ))}
            </select>
          )}

          {levelsPresent.length > 1 && (
            <div className="library-level-chips" role="group" aria-label="Filtra per livello">
              <button className={`library-chip ${level === "all" ? "is-active" : ""}`} onClick={() => setLevel("all")}>
                Tutti i livelli
              </button>
              {levelsPresent.map((l) => (
                <button key={l} className={`library-chip ${level === l ? "is-active" : ""}`} onClick={() => setLevel(l)}>
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          )}

          <select className="library-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} aria-label="Ordina">
            <option value="recent">Più recenti</option>
            <option value="title">Titolo A-Z</option>
            <option value="pages">Meno pagine</option>
          </select>
        </div>
      </div>

      <p className="library-results-count">
        {sorted.length === papers.length
          ? `${sorted.length} risultati`
          : `${sorted.length} di ${papers.length} risultati`}
      </p>

      {sorted.length === 0 ? (
        <p className="state-message">Nessun paper trovato per questi filtri.</p>
      ) : (
        <ul className="library-grid">
          {pageItems.map((p) => (
            <li key={p.slug} className="library-card">
              <Link to={`/paper/${p.slug}`} className="library-card-link">
                <PaperThumbnail pdfUrl={papersUrl(`${p.slug}/source/paper.pdf`)} label={p.title} />
                <div className="library-card-body">
                  <h2 className="library-card-title">{p.title}</h2>
                  <p className="library-authors">{formatAuthors(p.authors)}</p>
                  <div className="library-card-badges">
                    <span className="library-badge">{p.pageCount} pagine</span>
                    <span className="library-badge">{languageLabel(p.language)}</span>
                    {Array.from(new Set(p.variants.map((v) => v.level))).map((l) => (
                      <span key={l} className={`library-badge library-badge-level-${l}`}>
                        {LEVEL_LABELS[l]}
                      </span>
                    ))}
                  </div>
                  {p.tldr && <p className="library-tldr">{tldrTeaser(p)}</p>}
                  <p className="library-background">{p.background}</p>
                  <p className="library-meta">Importato il {formatImportedAt(p.importedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="library-pagination" aria-label="Paginazione">
          <button
            className="library-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Pagina precedente"
          >
            <ChevronLeftIcon />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`library-page-btn ${n === currentPage ? "is-active" : ""}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className="library-page-btn"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage === pageCount}
            aria-label="Pagina successiva"
          >
            <ChevronRightIcon />
          </button>
        </nav>
      )}
    </div>
  );
}
