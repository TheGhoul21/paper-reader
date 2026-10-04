import type { PaperStructure } from "../types";
import { pickVariant, type StructureIndex } from "../lib/structure";

interface Props {
  structure: PaperStructure;
  index: StructureIndex;
  variant: string;
  numbers: Map<string, number>;
  focusClaim: string | null;
  onFocusClaim: (claimId: string | null) => void;
  onGoToParagraph: (paragraphId: string) => void;
}

/**
 * The paper's argument at a glance: its thesis, then each claim with where it's stated, what
 * supports it and which claims it builds on. Focusing a claim highlights its paragraphs in the PDF.
 */
export default function ArgumentMap({
  structure,
  index,
  variant,
  numbers,
  focusClaim,
  onFocusClaim,
  onGoToParagraph,
}: Props) {
  const chips = (ids: string[]) =>
    ids
      .filter((id) => numbers.has(id))
      .sort((a, b) => numbers.get(a)! - numbers.get(b)!)
      .map((id) => (
        <button
          key={id}
          className="map-paragraph-chip"
          onClick={(e) => {
            e.stopPropagation();
            onGoToParagraph(id);
          }}
          title="Vai al paragrafo"
        >
          {numbers.get(id)}
        </button>
      ));

  return (
    <div className="argument-map">
      <div className="map-thesis">
        <div className="explanation-section">Tesi del paper</div>
        <p>{pickVariant(structure.thesis, variant)}</p>
      </div>

      <ol className="map-claims">
        {structure.claims.map((claim) => {
          const label = index.labels.get(claim.id)!;
          const focused = focusClaim === claim.id;
          const evidence = claim.evidence.filter((id) => !claim.statedIn.includes(id));
          return (
            <li
              key={claim.id}
              id={`claim-${claim.id}`}
              className={`map-claim${focused ? " is-focused" : ""}`}
            >
              <div className="map-claim-head">
                <span className="map-claim-label">{label}</span>
                <button
                  className="map-claim-title"
                  aria-pressed={focused}
                  onClick={() => onFocusClaim(focused ? null : claim.id)}
                >
                  {pickVariant(claim.title, variant)}
                </button>
              </div>
              <p className="map-claim-summary">{pickVariant(claim.summary, variant)}</p>
              <div className="map-claim-links">
                {claim.statedIn.length > 0 && (
                  <span className="map-link-group">
                    <span className="map-link-label">Enunciato in</span>
                    {chips(claim.statedIn)}
                  </span>
                )}
                {evidence.length > 0 && (
                  <span className="map-link-group">
                    <span className="map-link-label">Prove</span>
                    {chips(evidence)}
                  </span>
                )}
                {claim.dependsOn.length > 0 && (
                  <span className="map-link-group">
                    <span className="map-link-label">Si basa su</span>
                    {claim.dependsOn
                      .filter((id) => index.labels.has(id))
                      .map((id) => (
                        <button
                          key={id}
                          className="map-claim-chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusClaim(id);
                            document
                              .getElementById(`claim-${id}`)
                              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                          }}
                        >
                          {index.labels.get(id)}
                        </button>
                      ))}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
