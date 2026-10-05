import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCatalog } from "./catalog-data.mjs";

const root = join(process.cwd(), "papers");
const read = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
const library = read(join(root, "index.json"), []);
const catalog = buildCatalog(library, (slug) => ({
  meta: read(join(root, slug, "meta.json"), {}),
  paragraphs: read(join(root, slug, "paragraphs.json"), []),
  glossary: read(join(root, slug, "concepts.json"), []),
  structure: read(join(root, slug, "structure.json"), null),
}));
const json = JSON.stringify(catalog) + "\n";
writeFileSync(join(root, "catalog-index.json"), json);
console.log(
  `catalog-index.json: ${catalog.papers.length} papers, ${catalog.concepts.length} concepts, ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`,
);
