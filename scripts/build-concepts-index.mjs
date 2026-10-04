// Builds papers/concepts-index.json — concept id → every paper whose concepts.json defines it —
// from papers/index.json and each paper's concepts.json. Concept ids are shared across papers
// for the same concept, which is what lets the reader link "phase gadget" in one paper to the
// others. Deterministic: run it after adding or editing any concepts.json (the build runs it too).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const papersDir = join(process.cwd(), "papers");
const library = JSON.parse(readFileSync(join(papersDir, "index.json"), "utf8"));

const index = {};
for (const paper of library) {
  const file = join(papersDir, paper.slug, "concepts.json");
  if (!existsSync(file)) continue;
  const firstVariant = paper.variants[0]?.key;
  for (const concept of JSON.parse(readFileSync(file, "utf8"))) {
    (index[concept.id] ??= []).push({
      slug: paper.slug,
      title: paper.title,
      term: concept.term,
      definedIn: concept.definedIn,
      definition: concept.definitions[firstVariant] ?? Object.values(concept.definitions)[0] ?? "",
    });
  }
}

const sorted = Object.fromEntries(
  Object.keys(index)
    .sort()
    .map((id) => [id, index[id]]),
);
writeFileSync(join(papersDir, "concepts-index.json"), JSON.stringify(sorted, null, 2) + "\n");

const shared = Object.values(sorted).filter((entries) => entries.length > 1).length;
console.log(
  `concepts-index.json: ${Object.keys(sorted).length} concepts, ${shared} shared by 2+ papers`,
);
