// Validates papers/<slug>/concepts.json against the paper's data, using the reader's own matching
// code (src/lib/concepts.ts) and the same pdf.js text the reader highlights, so what passes here is
// what the reader shows.
//
//   node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_concepts.mjs <slug>
//   node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_concepts.mjs <slug> --grep '<regex>'
//
// Default mode prints, per concept, how many notes underline it (per variant) and how many times
// it's found in the PDF, then any problems: dangling definedIn/related ids, duplicate ids, missing
// variant definitions, concepts never matched in explanations, concepts with no PDF occurrences.
// --grep shows regex matches in the PDF text as the reader sees it (pdf.js splits math into
// separate items and uses its own glyphs, e.g. "t|ket〉" with U+3009), for choosing pdfTerms.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildConceptMatcher, pdfSpellings, segmentText, spellingPattern } from "../../../../src/lib/concepts.ts";

const [slug, flag, grepArg] = process.argv.slice(2);
if (!slug) {
  console.error("usage: check_concepts.mjs <slug> [--grep <regex>]");
  process.exit(2);
}
const dir = join(process.cwd(), "papers", slug);
const readJson = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));

// One string per page, built exactly like src/lib/conceptHighlight.ts builds it.
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(dir, "source/paper.pdf"))), verbosity: 0 }).promise;
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const content = await (await doc.getPage(n)).getTextContent();
  pages.push(content.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : "") : "")).join(""));
}

if (flag === "--grep") {
  const re = new RegExp(grepArg, "giu");
  let total = 0;
  pages.forEach((text, i) => {
    for (const m of text.matchAll(re)) {
      if (total++ < 20) console.log(`p${i + 1}`, JSON.stringify(text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)));
    }
  });
  console.log(`${total} matches`);
  process.exit(0);
}

const concepts = readJson("concepts.json");
const paragraphs = readJson("paragraphs.json");
const variants = readJson("meta.json").variants.map((v) => v.key);
const matcher = buildConceptMatcher(concepts);
const paragraphIds = new Set(paragraphs.map((p) => p.id));
const problems = [];
const seen = new Set();

for (const c of concepts) {
  if (seen.has(c.id)) problems.push(`duplicate id: ${c.id}`);
  seen.add(c.id);
  if (!paragraphIds.has(c.definedIn)) problems.push(`${c.id}: definedIn ${c.definedIn} is not in paragraphs.json`);
  for (const r of c.related) if (!matcher.byId.has(r)) problems.push(`${c.id}: related ${r} is not a concept in this file`);
  for (const v of variants) if (!c.definitions[v]) problems.push(`${c.id}: no definition for variant ${v}`);
}

for (const c of concepts) {
  const notes = variants.map(
    (v) => paragraphs.filter((p) => segmentText(p.explanations[v] ?? "", matcher).some((s) => typeof s !== "string" && s.conceptId === c.id)).length,
  );
  const pattern = spellingPattern(pdfSpellings(c));
  const inPdf = pattern ? pages.reduce((n, text) => n + [...text.matchAll(pattern)].length, 0) : 0;
  console.log(`${c.id.padEnd(30)} notes ${notes.join("/").padEnd(8)} pdf ${inPdf}`);
  if (notes.every((n) => n === 0)) problems.push(`${c.id}: never underlined in any explanation (check term/aliases spelling)`);
  if (inPdf === 0) problems.push(`${c.id}: no occurrences in the PDF (set pdfTerms; use --grep to find the PDF's spelling)`);
}

console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join("\n  ")}` : "\nOK");
process.exit(problems.length ? 1 : 0);
