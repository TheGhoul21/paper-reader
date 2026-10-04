import { pickVariant } from "../lib/structure";
import type { ReadingStep } from "../types";

export default function ReadingDiagram({
  diagram,
  variant,
}: {
  diagram: NonNullable<ReadingStep["diagram"]>;
  variant: string;
}) {
  const caption = pickVariant(diagram.caption, variant);
  return (
    <figure className="reading-diagram">
      <img src={`${import.meta.env.BASE_URL}${diagram.path}`} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
