import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CatalogSearch from "../components/catalog/CatalogSearch";
import CatalogPaperCard from "../components/catalog/CatalogPaperCard";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import {
  catalogConcepts,
  catalogFilters,
  createCatalogSearch,
  languageLabel,
  LEVEL_LABELS,
  LEVEL_ORDER,
  paginationPages,
} from "../lib/catalog";
import { useCatalog } from "../lib/useCatalog";
import { useUserData } from "../lib/storage";

const PAGE_SIZE = 20;

export default function Library() {
  const { catalog, error, retry } = useCatalog();
  const {
    data: { reading, journeys },
  } = useUserData();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(
    () => window.matchMedia("(min-width: 601px)").matches,
  );
  const filters = useMemo(() => catalogFilters(params), [params]);
  const query = useDeferredValue(filters.query);
  const search = useMemo(() => (catalog ? createCatalogSearch(catalog) : null), [catalog]);
  const results = useMemo(() => search?.({ ...filters, query }) ?? [], [search, query, filters]);
  const concepts = useMemo(() => (catalog ? catalogConcepts(catalog) : []), [catalog]);
  const languages = useMemo(
    () =>
      catalog
        ? [
            ...new Set(
              catalog.papers.flatMap((paper) => paper.variants.map((variant) => variant.language)),
            ),
          ].sort()
        : [],
    [catalog],
  );
  const levels = useMemo(
    () =>
      LEVEL_ORDER.filter((level) =>
        catalog?.papers.some((paper) => paper.variants.some((variant) => variant.level === level)),
      ),
    [catalog],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const requestedPage = Number(params.get("page"));
  const page = Math.min(
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageCount,
  );
  const items = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = [
    ...(filters.language !== "all"
      ? [{ key: "language", label: languageLabel(filters.language) }]
      : []),
    ...(filters.level !== "all"
      ? [{ key: "level", label: LEVEL_LABELS[filters.level as keyof typeof LEVEL_LABELS] }]
      : []),
    ...(filters.concept !== "all"
      ? [
          {
            key: "concept",
            label:
              concepts.find((concept) => concept.id === filters.concept)?.term ?? filters.concept,
          },
        ]
      : []),
    ...(filters.guide !== "all"
      ? [
          {
            key: "guide",
            label: filters.guide === "guided" ? "Con percorso a tappe" : "Senza percorso a tappe",
          },
        ]
      : []),
  ];
  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  function changePage(next: number) {
    changeFilter("page", String(next));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  if (error)
    return (
      <div className="state-message" role="alert">
        <p>Impossibile caricare il catalogo: {error}</p>
        <button onClick={retry}>Riprova</button>
      </div>
    );
  if (!catalog) return <p className="state-message">Caricamento…</p>;
  return (
    <div className="library library-catalog">
      <div className="library-hero">
        <h1 className="library-hero-title">Catalogo</h1>
      </div>
      <div className="library-controls">
        <CatalogSearch query={filters.query} onQuery={(value) => changeFilter("q", value)} />
        <select
          className="library-select"
          value={filters.sort}
          onChange={(event) => changeFilter("sort", event.target.value)}
          aria-label="Ordina"
        >
          <option value="relevance">Pertinenza</option>
          <option value="recent">Aggiunti di recente</option>
          <option value="title">Titolo A–Z</option>
          <option value="pages">Meno pagine</option>
        </select>
      </div>
      <details
        className="catalog-filter-panel"
        id="catalog-filters"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>Filtri{activeFilters.length ? ` · ${activeFilters.length} attivi` : ""}</summary>
        <div className="library-filters">
          {languages.length > 1 && (
            <label>
              Lingua delle spiegazioni
              <select
                className="library-select"
                value={filters.language}
                onChange={(event) => changeFilter("language", event.target.value)}
              >
                <option value="all">Tutte le lingue</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {languageLabel(language)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="catalog-level-filter">
            <span>Livello delle spiegazioni</span>
            <div className="library-level-chips" role="group" aria-label="Filtra per livello">
              <button
                className={`library-chip ${filters.level === "all" ? "is-active" : ""}`}
                aria-pressed={filters.level === "all"}
                onClick={() => changeFilter("level", "all")}
              >
                Tutti
              </button>
              {levels.map((level) => (
                <button
                  key={level}
                  className={`library-chip ${filters.level === level ? "is-active" : ""}`}
                  aria-pressed={filters.level === level}
                  onClick={() => changeFilter("level", level)}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
          <label>
            Concetto
            <select
              className="library-select catalog-concept-select"
              value={filters.concept}
              onChange={(event) => changeFilter("concept", event.target.value)}
            >
              <option value="all">Tutti i concetti</option>
              {[...concepts]
                .sort((a, b) => a.term.localeCompare(b.term, "it"))
                .map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.term} ({concept.count})
                  </option>
                ))}
            </select>
          </label>
          {catalog.papers.some((paper) => !paper.guideSteps) &&
            catalog.papers.some((paper) => paper.guideSteps) && (
              <label>
                Percorso
                <select
                  className="library-select"
                  value={filters.guide}
                  onChange={(event) => changeFilter("guide", event.target.value)}
                >
                  <option value="all">Tutti i paper</option>
                  <option value="guided">Con percorso a tappe</option>
                  <option value="pdf">Senza percorso a tappe</option>
                </select>
              </label>
            )}
        </div>
      </details>
      {activeFilters.length > 0 && (
        <div className="catalog-active-filters" aria-label="Filtri attivi">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => changeFilter(filter.key, "all")}
              aria-label={`Rimuovi filtro ${filter.label}`}
            >
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            onClick={() => {
              const next = new URLSearchParams(params);
              for (const { key } of activeFilters) next.delete(key);
              next.delete("page");
              setParams(next, { replace: true });
            }}
          >
            Rimuovi filtri
          </button>
        </div>
      )}
      <p className="library-results-count" role="status" aria-live="polite" aria-atomic="true">
        {results.length} paper
        {results.length
          ? ` · ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, results.length)}`
          : ""}
        {query !== filters.query ? " · Ricerca…" : ""}
      </p>
      {items.length ? (
        <ul className="library-grid catalog-results" aria-busy={query !== filters.query}>
          {items.map((paper) => (
            <CatalogPaperCard
              key={paper.slug}
              paper={paper}
              language={filters.language}
              level={filters.level}
              libraryPath="/catalog"
              librarySearch={params.toString()}
              reading={reading?.[paper.slug]}
              started={journeys?.[paper.slug]?.explored.length}
              headingLevel={2}
            />
          ))}
        </ul>
      ) : (
        <div className="state-message">
          <p>Nessun paper trovato.</p>
          <button onClick={() => setParams({}, { replace: true })}>Mostra tutti i paper</button>
        </div>
      )}
      {pageCount > 1 && (
        <nav className="library-pagination" aria-label="Paginazione">
          <button
            className="library-page-btn"
            onClick={() => changePage(page - 1)}
            disabled={page === 1}
            aria-label="Pagina precedente"
          >
            <ChevronLeftIcon />
          </button>
          {paginationPages(page, pageCount).map((item) =>
            typeof item === "number" ? (
              <button
                key={item}
                className={`library-page-btn ${item === page ? "is-active" : ""}`}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Pagina ${item}`}
                onClick={() => changePage(item)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="library-page-gap" aria-hidden="true">
                …
              </span>
            ),
          )}
          <button
            className="library-page-btn"
            onClick={() => changePage(page + 1)}
            disabled={page === pageCount}
            aria-label="Pagina successiva"
          >
            <ChevronRightIcon />
          </button>
        </nav>
      )}
    </div>
  );
}
