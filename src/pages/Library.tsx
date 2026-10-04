import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PaperThumbnail from "../components/PaperThumbnail";
import { pickTldr } from "../components/TldrStrip";
import { SearchIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { LibraryEntry, Variant } from "../types";
import { papersUrl } from "../lib/paths";
import { useUserData } from "../lib/storage";
import { parseLibrary } from "../lib/papers";
import { useDueCount } from "../lib/review";
import { guidedUrl } from "../lib/guidedReading";

const PAGE_SIZE = 12;

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

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0];
}

export default function Library() {
  const [papers, setPapers] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const language = params.get("language") ?? "all";
  const levelValue = params.get("level");
  const level = LEVEL_ORDER.includes(levelValue as Variant["level"])
    ? (levelValue as Variant["level"])
    : "all";
  const sortValue = params.get("sort");
  const sortBy: SortKey =
    sortValue && Object.hasOwn(SORTERS, sortValue) ? (sortValue as SortKey) : "recent";
  const requestedPage = Number(params.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const {
    data: { reading, journeys },
  } = useUserData();
  const [attempt, setAttempt] = useState(0);
  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  const dueCount = useDueCount();

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(papersUrl("index.json"), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((value: unknown) => {
        if (!controller.signal.aborted) setPapers(parseLibrary(value));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      });
    return () => controller.abort();
  }, [attempt]);

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
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)) ||
        Object.values(p.tldr ?? {}).some((summary) =>
          `${summary.problem} ${summary.idea}`.toLowerCase().includes(q),
        )
      );
    });
  }, [papers, query, language, level]);

  const sorted = useMemo(() => [...filtered].sort(SORTERS[sortBy]), [filtered, sortBy]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (error)
    return (
      <div className="state-message" role="alert">
        <p>Impossibile caricare la libreria: {error}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Riprova</button>
      </div>
    );
  if (!papers) return <p className="state-message">Caricamento…</p>;
  if (papers.length === 0) {
    return (
      <p className="state-message">
        La libreria è ancora vuota. I paper aggiunti compariranno qui.
      </p>
    );
  }
  const latestJourney = Object.entries(journeys ?? {})
    .filter(([slug]) => papers.some((p) => p.slug === slug))
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0];
  const resumePaper = latestJourney && papers.find((p) => p.slug === latestJourney[0]);

  return (
    <div className="library">
      <div className="library-hero">
        <h1 className="library-hero-title">Libreria</h1>
      </div>
      {resumePaper && latestJourney && (
        <section className="library-continue">
          <div>
            <span className="library-eyebrow">Lettura da riprendere</span>
            <h2>{resumePaper.title}</h2>
            <p>
              {latestJourney[1].phase === "summary"
                ? "La tua sintesi e i punti da rivedere"
                : `${latestJourney[1].explored.length} tappe esplorate · ${latestJourney[1].doubts.length} da rivedere`}
            </p>
          </div>
          <Link
            to={guidedUrl(resumePaper.slug, latestJourney[1])}
            state={{ librarySearch: params.toString() }}
          >
            Riprendi il percorso →
          </Link>
        </section>
      )}

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
            aria-label="Cerca paper per titolo, autore o problema"
            placeholder="Cerca un problema, un titolo o un autore…"
            value={query}
            onChange={(e) => changeFilter("q", e.target.value)}
          />
          {query && (
            <button
              className="library-search-clear"
              onClick={() => changeFilter("q", "")}
              aria-label="Cancella ricerca"
            >
              <CloseIcon width={14} height={14} />
            </button>
          )}
        </div>

        <div className="library-filters">
          {languages.length > 1 && (
            <select
              className="library-select"
              value={language}
              onChange={(e) => changeFilter("language", e.target.value)}
              aria-label="Filtra per lingua"
            >
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
              <button
                aria-pressed={level === "all"}
                className={`library-chip ${level === "all" ? "is-active" : ""}`}
                onClick={() => changeFilter("level", "all")}
              >
                Tutti i livelli
              </button>
              {levelsPresent.map((l) => (
                <button
                  key={l}
                  aria-pressed={level === l}
                  className={`library-chip ${level === l ? "is-active" : ""}`}
                  onClick={() => changeFilter("level", l)}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          )}

          <select
            className="library-select"
            value={sortBy}
            onChange={(e) => changeFilter("sort", e.target.value)}
            aria-label="Ordina"
          >
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
        <div className="state-message">
          <p>Nessun paper trovato. Prova un altro termine o rimuovi i filtri.</p>
          <button className="guided-secondary" onClick={() => setParams({}, { replace: true })}>
            Mostra tutti i paper
          </button>
        </div>
      ) : (
        <ul className="library-grid">
          {pageItems.map((p) => {
            const summary = pickTldr(p.tldr, p.language);
            return (
              <li key={p.slug} className="library-card">
                <Link
                  to={`/paper/${p.slug}${level !== "all" ? `?v=${encodeURIComponent(p.variants.find((v) => v.level === level)?.key ?? p.variants[0].key)}` : ""}`}
                  state={{ librarySearch: params.toString() }}
                  className="library-card-link"
                >
                  <PaperThumbnail
                    imageUrl={papersUrl(`${p.slug}/source/thumbnail.png`)}
                    label={p.title}
                  />
                  <div className="library-card-body">
                    {journeys?.[p.slug] && (
                      <span className="library-resume">
                        Già iniziato · {journeys[p.slug].explored.length} tappe esplorate
                      </span>
                    )}
                    <h2 className="library-card-title">{p.title}</h2>
                    <div className="library-card-badges">
                      <span className="library-badge">{p.pageCount} pagine</span>
                      <span className="library-badge">{languageLabel(p.language)}</span>
                      {Array.from(new Set(p.variants.map((v) => v.level))).map((l) => (
                        <span key={l} className={`library-badge library-badge-level-${l}`}>
                          {LEVEL_LABELS[l]}
                        </span>
                      ))}
                    </div>
                    {summary && (
                      <div className="library-tldr">
                        <p>
                          <span>Il problema</span>
                          {firstSentence(summary.problem)}
                        </p>
                        <p>
                          <span>L'idea</span>
                          {firstSentence(summary.idea)}
                        </p>
                      </div>
                    )}
                    <span className="library-explore">
                      Esplora il paper <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
                <div className="library-card-footer">
                  <span className="library-authors">{formatAuthors(p.authors)}</span>
                  <Link to={`/paper/${p.slug}?view=pdf`}>
                    {reading?.[p.slug]
                      ? `PDF · riprendi p. ${reading[p.slug].page}`
                      : "PDF originale"}{" "}
                    ↗
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="library-pagination" aria-label="Paginazione">
          <button
            className="library-page-btn"
            onClick={() => changeFilter("page", String(Math.max(1, currentPage - 1)))}
            disabled={currentPage === 1}
            aria-label="Pagina precedente"
          >
            <ChevronLeftIcon />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`library-page-btn ${n === currentPage ? "is-active" : ""}`}
              onClick={() => changeFilter("page", String(n))}
            >
              {n}
            </button>
          ))}
          <button
            className="library-page-btn"
            onClick={() => changeFilter("page", String(Math.min(pageCount, currentPage + 1)))}
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
