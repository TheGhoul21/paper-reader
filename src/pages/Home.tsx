import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import CatalogSearch from "../components/catalog/CatalogSearch";
import CatalogPaperCard from "../components/catalog/CatalogPaperCard";
import RecentReadings from "../components/catalog/RecentReadings";
import { catalogConcepts } from "../lib/catalog";
import { useCatalog } from "../lib/useCatalog";
import { useDueCount } from "../lib/review";
import { useUserData } from "../lib/storage";

export default function Home() {
  const { catalog, error, retry } = useCatalog();
  const {
    data: { reading, journeys },
  } = useUserData();
  const dueCount = useDueCount();
  const [query, setQuery] = useState("");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const concepts = useMemo(() => (catalog ? catalogConcepts(catalog).slice(0, 8) : []), [catalog]);
  const recent = useMemo(
    () =>
      catalog
        ? [...catalog.papers].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 4)
        : [],
    [catalog],
  );
  // Published bookmarks used the homepage for catalog queries before /catalog existed.
  if (["q", "language", "level", "concept", "guide", "sort", "page"].some((key) => params.has(key)))
    return <Navigate to={`/catalog?${params}`} replace />;
  return (
    <div className="library library-home">
      <div className="library-hero">
        <h1 className="library-hero-title">Libreria</h1>
        <CatalogSearch
          query={query}
          onQuery={setQuery}
          submit={() =>
            navigate(
              query.trim() ? `/catalog?${new URLSearchParams({ q: query.trim() })}` : "/catalog",
            )
          }
        />
        <Link to="/catalog" className="home-catalog-link">
          Catalogo completo{catalog ? ` · ${catalog.papers.length} paper` : ""} →
        </Link>
      </div>
      {error && (
        <div className="state-message" role="alert">
          <p>Impossibile caricare il catalogo: {error}</p>
          <button onClick={retry}>Riprova</button>
        </div>
      )}
      {!catalog && !error && <p className="state-message">Caricamento…</p>}
      {catalog && (
        <>
          <RecentReadings catalog={catalog} />
          {dueCount > 0 && (
            <Link to="/review" className="review-banner">
              <strong>{dueCount}</strong> da ripassare oggi <span aria-hidden="true">→</span>
            </Link>
          )}
          {concepts.length > 0 && (
            <section className="home-section" aria-labelledby="home-concepts-heading">
              <div className="home-section-title">
                <h2 id="home-concepts-heading">Concetti</h2>
                <Link to="/catalog#catalog-filters">Tutti i concetti →</Link>
              </div>
              <ul className="home-concepts">
                {concepts.map((concept) => (
                  <li key={concept.id}>
                    <Link to={`/catalog?${new URLSearchParams({ concept: concept.id })}`}>
                      <span>{concept.term}</span>
                      <span className="home-concept-count">{concept.count} paper</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="home-section" aria-labelledby="home-recent-heading">
            <div className="home-section-title">
              <h2 id="home-recent-heading">Aggiunti di recente</h2>
              <Link to="/catalog?sort=recent">Mostra tutti →</Link>
            </div>
            {recent.length ? (
              <ul className="library-grid home-paper-grid">
                {recent.map((paper) => (
                  <CatalogPaperCard
                    key={paper.slug}
                    paper={paper}
                    libraryPath="/"
                    reading={reading?.[paper.slug]}
                    started={journeys?.[paper.slug]?.explored.length}
                  />
                ))}
              </ul>
            ) : (
              <p className="state-message">Nessun paper disponibile.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
