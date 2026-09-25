import type { Paragraph } from "../types";

interface Props {
  paragraphs: Paragraph[];
  numbers: Map<string, number>;
  width: number;
  height: number;
  activeId: string | null;
  hoverId: string | null;
  onSelect: (paragraph: Paragraph) => void;
  onHover: (id: string | null) => void;
  /** "Il filo" on: paragraphs outside this set are dimmed. */
  thread?: Set<string> | null;
  /** Paragraphs of the claim focused in the argument map. */
  focus?: Set<string> | null;
}

const BADGE_SIZE = 18;

export default function ParagraphOverlay({ paragraphs, numbers, width, height, activeId, hoverId, onSelect, onHover, thread, focus }: Props) {
  return (
    <div className="paragraph-overlay" style={{ width, height }}>
      {paragraphs.map((p) => {
        const state =
          (p.id === activeId ? " is-active" : p.id === hoverId ? " is-highlighted" : "") +
          (focus?.has(p.id) ? " is-in-focus" : "") +
          (thread && !thread.has(p.id) ? " is-off-thread" : "");
        const [bx, by] = p.rects[0] ?? [0, 0];
        // Badge sits just left of the paragraph (in the margin / column gutter), inside if there's no room.
        const badgeLeft = bx * width - BADGE_SIZE - 3 >= 0 ? bx * width - BADGE_SIZE - 3 : bx * width + 2;
        return (
          <div key={p.id} onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)}>
            {p.rects.map(([x0, y0, x1, y1], i) => (
              <button
                key={i}
                className={`paragraph-hit${state}`}
                style={{
                  left: x0 * width,
                  top: y0 * height,
                  width: (x1 - x0) * width,
                  height: (y1 - y0) * height,
                }}
                onClick={() => onSelect(p)}
                aria-label="Mostra spiegazione"
              />
            ))}
            <button className={`paragraph-badge paragraph-badge-pdf${state}`} style={{ left: badgeLeft, top: by * height }} onClick={() => onSelect(p)} tabIndex={-1}>
              {numbers.get(p.id)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
