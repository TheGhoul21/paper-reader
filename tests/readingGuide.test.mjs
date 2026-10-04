import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { indexReadingGuide } from "../src/lib/readingGuide.ts";

const paper = "optimizing-atom-transport-gate-count-and-depth-with";
const read = (name) => JSON.parse(readFileSync(new URL(`../papers/${paper}/${name}.json`, import.meta.url), "utf8"));
const structure = read("structure");
const paragraphs = read("paragraphs");

test("the original section II guide remains intact within the whole-paper guide", () => {
  const contexts = indexReadingGuide(structure.readingGuide);
  const sectionIds = paragraphs.filter((p) => p.section === "II. Parity Twine Networks").map((p) => p.id);
  const section = structure.readingGuide.find((s) => s.id === "parity-twine-networks");
  assert.deepEqual(section.steps.flatMap((s) => s.paragraphs).sort(), sectionIds.sort());
  assert.equal(section.steps.length, 6);
  assert.equal(contexts.size, paragraphs.length);
  assert.equal(contexts.get("p0024").step.id, "ladder-layout");
  assert.equal(contexts.get("p0027").step.id, "gate-count-depth");
  assert.notEqual(contexts.get("p0030").section.id, section.id);
});

const library = JSON.parse(readFileSync(new URL("../papers/index.json", import.meta.url), "utf8"));
for (const { slug } of library) {
  test(`${slug}: every paragraph has one ordered context in every existing reading level`, () => {
    const data = (name) => JSON.parse(readFileSync(new URL(`../papers/${slug}/${name}.json`, import.meta.url), "utf8"));
    const ordered = data("paragraphs").sort((a, b) => a.page - b.page || a.order - b.order);
    const guides = data("structure").readingGuide;
    const variants = data("meta").variants.map((v) => v.key).sort();
    const position = new Map(ordered.map((p, i) => [p.id, i]));
    assert.ok(guides?.length, "a complete guide is required for every imported paper");
    assert.equal(new Set(guides.map((s) => s.id)).size, guides.length);
    assert.deepEqual(guides.flatMap((s) => s.steps.flatMap((step) => step.paragraphs)), ordered.map((p) => p.id));
    const contexts = indexReadingGuide(guides);
    assert.equal(contexts.size, ordered.length);
    const checkText = (texts) => {
      assert.deepEqual(Object.keys(texts).sort(), variants);
      for (const key of variants) assert.ok(typeof texts[key] === "string" && texts[key].trim());
    };
    for (const section of guides) {
      checkText(section.title);
      checkText(section.goal);
      assert.ok(section.steps.length);
      assert.equal(new Set(section.steps.map((s) => s.id)).size, section.steps.length);
      for (const [i, step] of section.steps.entries()) {
        for (const field of [step.title, step.meaning, step.purpose]) checkText(field);
        for (const id of step.paragraphs) {
          assert.equal(contexts.get(id).section, section);
          assert.equal(contexts.get(id).step, step);
          assert.equal(contexts.get(id).stepIndex, i);
        }
        if (step.diagram) {
          checkText(step.diagram.caption);
          assert.ok(readFileSync(new URL(`../public/${step.diagram.path}`, import.meta.url)).length);
        }
      }
      if (section.leadsTo) {
        checkText(section.leadsTo.why);
        assert.ok(position.get(section.leadsTo.paragraphId) > position.get(section.steps.at(-1).paragraphs.at(-1)));
        assert.ok(contexts.has(section.leadsTo.paragraphId), "next passage must also have context");
      }
    }
  });
}

test("both existing reading levels explain the physical meaning of the ladder", () => {
  const { step } = indexReadingGuide(structure.readingGuide).get("p0024");
  for (const { key } of read("meta").variants) {
    assert.match(step.meaning[key], /qubit fisici/);
    assert.ok(step.purpose[key]);
    assert.ok(step.diagram.caption[key]);
  }
  assert.ok(readFileSync(new URL(`../public/${step.diagram.path}`, import.meta.url)).length);
});

test("captions, continuations and footnotes keep the context of their passage", () => {
  const contexts = indexReadingGuide(structure.readingGuide);
  assert.equal(contexts.get("p0018").step, contexts.get("p0019").step);
  assert.equal(contexts.get("p0021").step, contexts.get("p0020").step);
  assert.equal(contexts.get("p0026").step, contexts.get("p0027").step);
});

test("papers without guides have no extra context", () => {
  assert.equal(indexReadingGuide().size, 0);
  assert.equal(indexReadingGuide([]).size, 0);
});
