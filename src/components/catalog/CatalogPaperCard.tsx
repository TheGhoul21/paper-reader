import { Link } from "react-router-dom";
import { languageLabel, LEVEL_LABELS, LEVEL_ORDER, type CatalogPaper } from "../../lib/catalog";
import type { ReadingPosition } from "../../lib/readingProgress";

export default function CatalogPaperCard({
  paper,
  language = "all",
  level = "all",
  libraryPath,
  librarySearch = "",
  reading,
  started,
  headingLevel = 3,
}: {
  paper: CatalogPaper;
  language?: string;
  level?: string;
  libraryPath: "/" | "/catalog";
  librarySearch?: string;
  reading?: ReadingPosition;
  started?: number;
  headingLevel?: 2 | 3;
}) {
  const variant = paper.variants.find(
    (item) =>
      (language === "all" || item.language === language) &&
      (level === "all" || item.level === level),
  );
  const params = new URLSearchParams();
  if ((language !== "all" || level !== "all") && variant) params.set("v", variant.key);
  const state = { libraryPath, librarySearch };
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const levels = LEVEL_ORDER.filter((item) => paper.variants.some((value) => value.level === item));
  const languages = [...new Set(paper.variants.map((value) => value.language))];
  return (
    <li className="library-card">
      <article>
        <Link
          to={`/paper/${paper.slug}${params.size ? `?${params}` : ""}`}
          state={state}
          className="library-card-link"
        >
          <div className="library-card-body">
            <Heading className="library-card-title">{paper.title}</Heading>
            <p className="library-authors">
              {paper.authors.length <= 3
                ? paper.authors.join(", ")
                : `${paper.authors.slice(0, 3).join(", ")} et al.`}
            </p>
            {paper.problem && <p className="library-card-problem">{paper.problem}</p>}
            <div className="library-card-badges">
              <span>{paper.pageCount} pagine</span>
              <span>{languages.map(languageLabel).join(", ")}</span>
              <span>Spiegazioni: {levels.map((item) => LEVEL_LABELS[item]).join(", ")}</span>
              <span>
                {paper.guideSteps ? `${paper.guideSteps} tappe` : "Senza percorso a tappe"}
              </span>
              <span>
                {paper.explainedPages}/{paper.pageCount} pagine con spiegazioni
              </span>
              {started !== undefined && (
                <span className="library-resume">{started} tappe esplorate</span>
              )}
            </div>
          </div>
          <span className="library-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>
        <div className="library-card-footer">
          {paper.identifiers[0] && (
            <span className="library-identifier">{paper.identifiers[0]}</span>
          )}
          <Link
            to={`/paper/${paper.slug}?view=pdf${variant && (language !== "all" || level !== "all") ? `&v=${encodeURIComponent(variant.key)}` : ""}`}
            state={state}
          >
            {reading ? `PDF · riprendi p. ${reading.page}` : "PDF originale"} ↗
          </Link>
        </div>
      </article>
    </li>
  );
}
