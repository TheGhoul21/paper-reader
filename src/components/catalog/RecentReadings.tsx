import { Link } from "react-router-dom";
import type { Catalog } from "../../lib/catalog";
import { guidedUrl } from "../../lib/guidedReading";
import { useUserData } from "../../lib/storage";

export default function RecentReadings({ catalog }: { catalog: Catalog }) {
  const {
    data: { journeys, reading },
  } = useUserData();
  const recent = catalog.papers
    .flatMap((paper) => {
      const journey = journeys?.[paper.slug];
      const position = reading?.[paper.slug];
      if (!journey && !position) return [];
      const updatedAt = [journey?.updatedAt, position?.updatedAt]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1)!;
      return [{ paper, journey, position, updatedAt }];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  if (!recent.length) return null;
  return (
    <section className="home-section" aria-labelledby="recent-readings-heading">
      <h2 id="recent-readings-heading">Letture da riprendere</h2>
      <ul className="home-resume-list">
        {recent.map(({ paper, journey, position }) => (
          <li key={paper.slug} className="library-continue">
            <div>
              <h3>{paper.title}</h3>
              <p>
                {journey
                  ? journey.phase === "summary"
                    ? "Sintesi e tappe da rivedere"
                    : `${journey.explored.length} tappe esplorate · ${journey.doubts.length} da rivedere`
                  : `PDF · pagina ${position!.page} di ${paper.pageCount}`}
              </p>
            </div>
            <Link
              to={journey ? guidedUrl(paper.slug, journey) : `/paper/${paper.slug}?view=pdf`}
              state={{ libraryPath: "/" }}
            >
              {journey ? "Riprendi il percorso →" : "Riprendi il PDF →"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
