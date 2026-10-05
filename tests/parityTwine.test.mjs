import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parityLabel, twineCircuit, twinePairs, twineSnapshot } from "../src/lib/parityTwine.ts";
import { TWINE_SOURCE_SHA256 } from "../src/lib/parityTwinePrograms.ts";
import { loadModule } from "./helpers/modules.mjs";
import { verifyFigureImages } from "../scripts/figure-data.mjs";

for (const [panel, count, expected] of [
  ["a", 35, [32, 16, 8, 4, 2, 1]],
  ["b", 26, [1, 8, 4, 32, 16, 2]],
  ["c", 29, [32, 16, 8, 4, 2, 1]],
]) {
  test(`Figure 2(${panel}): all 15 pairs, original output permutation and physical edges`, () => {
    const circuit = twineCircuit(panel);
    assert.equal(circuit.gates.length, count);
    assert.equal(
      new Set(circuit.edges.map((e) => [e.from, e.to].sort().join("-"))).size,
      circuit.edges.length,
    );
    for (const gate of circuit.gates) {
      assert.ok(
        circuit.edges.some(
          (edge) =>
            [edge.from, edge.to].includes(gate.control) &&
            [edge.from, edge.to].includes(gate.target),
        ),
        `gate ${gate.step} uses a source-layout edge`,
      );
      assert.notEqual(gate.control, gate.target);
    }
    const final = twineSnapshot(circuit, count);
    assert.deepEqual(final.labels, expected, "right-hand labels of the original drawing");
    assert.deepEqual(
      [...final.pairs].sort((a, b) => a - b),
      twinePairs(6).sort((a, b) => a - b),
    );
    assert.ok(circuit.gates.some((g) => g.role === "decoder"));
    assert.equal(
      circuit.gates.some((g) => g.role === "leg"),
      panel !== "a",
    );
  });
}

test("CNOTs change only their target and every source gate sequence is invertible", () => {
  for (const panel of ["a", "b", "c"]) {
    const circuit = twineCircuit(panel);
    for (let step = 1; step <= circuit.gates.length; step++) {
      const { labels, active } = twineSnapshot(circuit, step);
      const before = twineSnapshot(circuit, step - 1).labels;
      labels.forEach((label, i) =>
        assert.equal(label, i === active.target ? before[i] ^ before[active.control] : before[i]),
      );
      const images = new Set();
      for (let input = 0; input < 64; input++) {
        const parity = (mask) => (mask & input).toString(2).replaceAll("0", "").length % 2;
        images.add(labels.map(parity).join(""));
      }
      assert.equal(images.size, 64, `${panel} invertible at gate ${step}`);
    }
  }
  const linear = twineCircuit("a");
  assert.deepEqual(
    twineSnapshot(linear, 2).labels.slice(0, 2),
    [3, 1],
    "the first two CNOTs perform DCNOT",
  );
  assert.equal(parityLabel(33), "ℓ₁ℓ₆");
});

test("the animated figure matches the indicated paper, source crop and stable caption ID", () => {
  const slug = "optimizing-atom-transport-gate-count-and-depth-with";
  const folder = `papers/${slug}`;
  verifyFigureImages(folder);
  const json = (name) => JSON.parse(readFileSync(`${folder}/${name}.json`, "utf8"));
  const { parsePaper } = loadModule("src/lib/papers.ts");
  const structure = json("structure");
  const parse = (data) =>
    parsePaper(slug, json("meta"), json("paragraphs"), json("concepts"), data, {});
  const figure = parse(structure).structure.figures[0];
  assert.equal(figure.sourceSha256, TWINE_SOURCE_SHA256);
  assert.equal(figure.captionParagraph, "p0018");
  assert.equal(figure.page, 1);
  assert.equal(figure.references.find((r) => r.paragraphId === "p0024").panel, "c");
  for (const patch of [
    { page: 19 },
    { sourceSha256: "0".repeat(64) },
    { image: "../source/paper.pdf" },
    { rect: [0.8, 0, 0.2, 0.4] },
    { caption: {} },
    { references: [{ paragraphId: "unknown" }] },
    { references: [{ paragraphId: "p0018", panel: "z" }] },
  ])
    assert.throws(
      () => parse({ ...structure, figures: [{ ...structure.figures[0], ...patch }] }),
      /figure/,
    );
});
