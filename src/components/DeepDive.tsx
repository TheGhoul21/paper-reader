import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderDeepDive } from "../lib/deepDive";

interface Props {
  markdown: string;
  /** A `[text](#p0039)` link in the deep dive: bring that paragraph up in both panes. */
  onGoToParagraph: (paragraphId: string) => void;
}

/** The optional long-form explanation under a note: worked examples, formulas, links to other paragraphs. Lazy-loaded (KaTeX is heavy). */
export default function DeepDive({ markdown, onGoToParagraph }: Props) {
  const html = useMemo(() => renderDeepDive(markdown), [markdown]);
  return (
    // Native anchors generate click for keyboard activation; this handler only delegates.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="deep-dive"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const link = (e.target as HTMLElement).closest("a");
        const href = link?.getAttribute("href");
        if (!href?.startsWith("#")) return;
        e.preventDefault();
        e.stopPropagation();
        onGoToParagraph(href.slice(1));
      }}
    />
  );
}
