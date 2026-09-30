// Validates the `deepDive` fields of papers/<slug>/paragraphs.json with the reader's own renderer
// (src/lib/deepDive.ts), so what passes here is what the reader shows.
//
//   node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_deep_dives.mjs <slug>
//
// Checks: every deepDive key is one of meta.json's variants; every formula compiles in KaTeX;
// every `[text](#id)` link points at an existing paragraph, and a "par. N" link text matches that
// paragraph's number in the reader (reading order, 1-based). Prints how many paragraphs have one
// and their word counts, since the long form should stay in the 150–400 word range.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import katex from "katex";
import { deepDiveLinks, deepDiveMath } from "../../../../src/lib/deepDive.ts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: check_deep_dives.mjs <slug>");
  process.exit(2);
}
const dir = join(process.cwd(), "papers", slug);
const readJson = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));
const paragraphs = readJson("paragraphs.json").sort((a, b) => a.page - b.page || a.order - b.order);
const variants = new Set(readJson("meta.json").variants.map((v) => v.key));
const number = new Map(paragraphs.map((p, i) => [p.id, i + 1]));

const problems = [];
let count = 0;
for (const p of paragraphs) {
  if (!p.deepDive) continue;
  count++;
  for (const [variant, markdown] of Object.entries(p.deepDive)) {
    const where = `${p.id} (par. ${number.get(p.id)}) ${variant}`;
    if (!variants.has(variant)) problems.push(`${where}: not a variant in meta.json`);
    for (const { tex, display } of deepDiveMath(markdown)) {
      try {
        katex.renderToString(tex, { displayMode: display, throwOnError: true });
      } catch (e) {
        problems.push(`${where}: KaTeX: ${e.message.split("\n")[0]}`);
      }
    }
    for (const { text, paragraphId } of deepDiveLinks(markdown)) {
      if (!number.has(paragraphId)) {
        problems.push(`${where}: link to missing paragraph #${paragraphId}`);
        continue;
      }
      const n = text.match(/^par\. (\d+)$/)?.[1];
      if (n && Number(n) !== number.get(paragraphId)) {
        problems.push(`${where}: "${text}" points at #${paragraphId}, which is par. ${number.get(paragraphId)}`);
      }
    }
    // A lone "$" left over means a formula didn't close.
    if (markdown.replace(/\$\$[\s\S]+?\$\$/g, "").replace(/\$[^$\n]+\$/g, "").includes("$")) {
      problems.push(`${where}: unbalanced $`);
    }
    const words = markdown.split(/\s+/).filter(Boolean).length;
    console.log(`${where}: ${words} words`);
  }
}
console.log(`${count}/${paragraphs.length} paragraphs have a deep dive`);
for (const msg of problems) console.log(msg);
console.log(problems.length ? "problems found — see above" : "OK");
process.exit(problems.length ? 1 : 0);
