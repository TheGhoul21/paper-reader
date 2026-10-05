import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { buildCatalog } from "../scripts/catalog-data.mjs";
import { loadModule } from "./helpers/modules.mjs";

const { parseCatalog, createCatalogSearch, paginationPages } = loadModule("src/lib/catalog.ts");
const filters = {
  query: "",
  language: "all",
  level: "all",
  concept: "all",
  guide: "all",
  sort: "relevance",
};
const variant = (language, level) => ({
  key: `${language}-${level}`,
  language,
  level,
  label: `${language} ${level}`,
});
const paper = (slug, fields = {}) => ({
  slug,
  title: slug,
  authors: ["Ada Example"],
  importedAt: "2026-10-01T00:00:00Z",
  pageCount: 10,
  variants: [variant("it", "beginner")],
  problem: "A problem",
  summary: "A problem",
  identifiers: [],
  concepts: [],
  guideSteps: 1,
  explainedPages: 1,
  ...fields,
});

test("catalog generation preserves real concept aliases and source ids without calling anchor coverage complete", () => {
  const library = [
    {
      ...paper("example"),
      language: "it",
      tldr: { it: { problem: "Prima frase. Seconda frase.", idea: "Proposta reale." } },
    },
  ];
  const generated = buildCatalog(library, () => ({
    meta: { sourceType: "arxiv", sourceRef: "https://arxiv.org/abs/2501.14020v2" },
    glossary: [
      { id: "circuit-cutting", term: "circuit cutting", aliases: ["taglio dei circuiti"] },
    ],
    paragraphs: [
      {
        page: 0,
        explanations: { "it-beginner": "Spiegazione" },
        anchors: [{ page: 0 }, { page: 1 }],
      },
      { page: 1, explanations: { "it-beginner": "Altra" } },
    ],
    structure: { readingGuide: [{ steps: [{ id: "a" }, { id: "b" }] }] },
  }));
  assert.equal(generated.papers[0].problem, "Prima frase.");
  assert.equal(generated.papers[0].explainedPages, 2);
  assert.equal(generated.papers[0].guideSteps, 2);
  assert.ok(generated.papers[0].identifiers.includes("2501.14020v2"));
  assert.equal(generated.concepts[0].aliases[0], "taglio dei circuiti");
  assert.equal("complete" in generated.papers[0], false);
  assert.equal(parseCatalog(generated).papers[0].slug, "example");
});

test("search finds actual aliases, accents, DOI and arXiv and requires every query token", () => {
  const catalog = {
    version: 1,
    concepts: [{ id: "cut", term: "taglio di circuiti", aliases: ["circuit cutting"] }],
    papers: [
      paper("cut", {
        concepts: ["cut"],
        authors: ["Áda Étienne"],
        identifiers: ["2501.14020v2", "10.1103/6xlb-l92j"],
      }),
      paper("other"),
    ],
  };
  const search = createCatalogSearch(catalog);
  for (const query of [
    "circuit cutting",
    "ADA ETIENNE",
    "https://doi.org/10.1103/6xlb-l92j",
    "arxiv:2501.14020v2",
  ]) {
    // Users can paste the usual identifier prefixes and URLs.
    assert.equal(search({ ...filters, query })[0].slug, "cut");
  }
  assert.equal(search({ ...filters, query: "circuit missing" }).length, 0);
  assert.equal(search({ ...filters, query: "circuit Ada" })[0].slug, "cut");
});

test("relevance prefers a title match to summary text and combines language and level on one variant", () => {
  const catalog = {
    version: 1,
    concepts: [],
    papers: [
      paper("summary", {
        summary: "Circuit cutting",
        variants: [variant("it", "beginner"), variant("en", "expert")],
      }),
      paper("title", { title: "Circuit cutting", variants: [variant("it", "expert")] }),
    ],
  };
  const search = createCatalogSearch(catalog);
  assert.equal(search({ ...filters, query: "circuit cutting" })[0].slug, "title");
  assert.deepEqual(
    Array.from(search({ ...filters, language: "it", level: "expert" }), (entry) => entry.slug),
    ["title"],
  );
  assert.equal(search({ ...filters, guide: "pdf" }).length, 0);
});

test("a catalog with thousands of papers has bounded, navigable pagination", () => {
  const middle = Array.from(paginationPages(250, 500));
  assert.deepEqual(middle, [1, "gap-before", 249, 250, 251, "gap-after", 500]);
  assert.deepEqual(Array.from(paginationPages(1, 500)), [1, 2, "gap-after", 500]);
  assert.deepEqual(Array.from(paginationPages(2, 3)), [1, 2, 3]);
});

test("the committed catalog matches every paper and rejects broken cross-references or duplicate slugs", () => {
  const json = (path, fallback) =>
    existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
  const actual = parseCatalog(json("papers/catalog-index.json"));
  assert.deepEqual(
    Array.from(actual.papers, (entry) => entry.slug),
    json("papers/index.json").map((entry) => entry.slug),
  );
  const fresh = buildCatalog(json("papers/index.json"), (slug) => ({
    meta: json(`papers/${slug}/meta.json`),
    paragraphs: json(`papers/${slug}/paragraphs.json`),
    glossary: json(`papers/${slug}/concepts.json`, []),
    structure: json(`papers/${slug}/structure.json`, null),
  }));
  assert.equal(
    JSON.stringify(actual),
    JSON.stringify(fresh),
    "Run npm run catalog-index after editorial changes",
  );
  const duplicate = JSON.parse(JSON.stringify(actual));
  duplicate.papers.push(duplicate.papers[0]);
  assert.throws(() => parseCatalog(duplicate), /Paper/);
  const broken = JSON.parse(JSON.stringify(actual));
  broken.papers[0].concepts.push("missing-concept");
  assert.throws(() => parseCatalog(broken), /Paper/);
});
