import { marked } from "marked";
import katex from "katex";

// `$$…$$` (display) or `$…$` (inline, no space just inside the dollars, so "costa 5 $ e 3 $" stays text).
const MATH = /\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g;

/** Every formula in a deep dive, in order, with whether it's display math. */
export function deepDiveMath(markdown: string): { tex: string; display: boolean }[] {
  return [...markdown.matchAll(MATH)].map((m) => ({ tex: m[1] ?? m[2], display: m[1] !== undefined }));
}

/** Every `[text](#<paragraphId>)` link in a deep dive. */
export function deepDiveLinks(markdown: string): { text: string; paragraphId: string }[] {
  return [...markdown.matchAll(/\[([^\]]*)\]\(#([^)\s]+)\)/g)].map((m) => ({ text: m[1], paragraphId: m[2] }));
}

/**
 * Markdown + LaTeX to HTML. Math is cut out before markdown runs (so `_` and `*` inside formulas
 * aren't read as emphasis) and pasted back as KaTeX output afterwards.
 */
export function renderDeepDive(markdown: string): string {
  const math: string[] = [];
  const source = markdown.replace(MATH, (_, display: string | undefined, inline: string | undefined) => {
    math.push(katex.renderToString(display ?? inline ?? "", { displayMode: display !== undefined, throwOnError: false }));
    return `@@MATH${math.length - 1}@@`;
  });
  const html = marked.parse(source, { async: false });
  return html
    .replace(/@@MATH(\d+)@@/g, (_, i: string) => math[Number(i)])
    .replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener noreferrer" href="$1');
}
