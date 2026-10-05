import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OQFT_STAGES } from "../src/lib/oqftBlocks.ts";
import { TRANSPORT_STAGES, transportDistance } from "../src/lib/atomTransport.ts";
import { verifyFigureImages } from "../scripts/figure-data.mjs";
import { loadModule } from "./helpers/modules.mjs";

test("Figure 7 preserves block identity and four distinct local labels at every stage", () => {
  for (const state of OQFT_STAGES) {
    assert.deepEqual(state.blocks.map((b) => b.id).sort(), ["A", "B", "C", "D"]);
    assert.equal(new Set(state.blocks.map((b) => `${b.column}:${b.row}`)).size, 4);
    for (const b of state.blocks)
      assert.deepEqual(
        [...b.labels].sort((a, b) => a - b),
        b.id === "A" || b.id === "C" ? [1, 2, 3, 4] : [5, 6, 7, 8],
      );
  }
  const byId = (step, id) => OQFT_STAGES[step].blocks.find((b) => b.id === id);
  for (const id of ["A", "B", "C", "D"])
    assert.deepEqual(byId(1, id).labels, [...byId(0, id).labels].reverse());
  for (const id of ["A", "B", "D"])
    assert.deepEqual(byId(2, id).labels, [...byId(1, id).labels].reverse());
  assert.deepEqual(byId(2, "C"), byId(1, "C"), "note 5: C receives no intermediate inverse QFT");
  assert.deepEqual(byId(4, "C").labels, byId(3, "C").labels, "C also skips the final QFT layer");
});

test("Figure 7's two collective transports move only their column and preserve every label", () => {
  for (const [from, to, ids, dx, dy] of [
    [2, 3, ["B", "D"], 0, -1],
    [4, 5, ["A", "C"], 2, -1],
  ]) {
    const before = OQFT_STAGES[from],
      after = OQFT_STAGES[to];
    assert.equal(after.operation, "transport");
    for (const old of before.blocks) {
      const next = after.blocks.find((b) => b.id === old.id);
      assert.deepEqual(next.labels, old.labels);
      assert.equal(next.column - old.column, ids.includes(old.id) ? dx : 0);
      assert.equal(next.row - old.row, ids.includes(old.id) ? dy : 0);
    }
  }
  const final = [...OQFT_STAGES[5].blocks].sort((a, b) => a.row - b.row || a.column - b.column);
  assert.deepEqual(
    final.map((b) => b.id),
    ["B", "A", "D", "C"],
  );
  assert.deepEqual(
    final.map((b) => b.labels),
    [
      [7, 5, 8, 6],
      [3, 1, 4, 2],
      [7, 5, 8, 6],
      [3, 1, 4, 2],
    ],
    "all four patches at t₅ in the original",
  );
});

test("Figure 8 has one CZ per protocol and the original trap ownership and final zones", () => {
  const { cz, czswap } = TRANSPORT_STAGES;
  assert.equal(cz.length, 6, "initial state plus five source steps");
  assert.equal(czswap.length, 8, "initial state plus seven source steps");
  assert.deepEqual(cz[3].A, { site: "near", trap: "AOD" });
  assert.equal(cz[3].interacting, true);
  assert.deepEqual(czswap[4].A, { site: "near", trap: "SLM" });
  assert.deepEqual(czswap[4].B, { site: "upper", trap: "SLM" });
  assert.equal(czswap[4].interacting, true);
  assert.deepEqual(cz.at(-1).A, { site: "lower", trap: "SLM" });
  assert.deepEqual(cz.at(-1).B, { site: "upper", trap: "SLM" });
  assert.deepEqual(czswap.at(-1).A, { site: "near", trap: "SLM" });
  assert.deepEqual(czswap.at(-1).B, { site: "lower", trap: "SLM" });
  for (const states of [cz, czswap]) {
    assert.equal(states.filter((s) => s.interacting).length, 1);
    assert.equal(states.at(-1).czGates, 1);
    for (let i = 1; i < states.length; i++) {
      const previous = states[i - 1],
        next = states[i];
      assert.notEqual(next.A.site, next.B.site, "atoms occupy distinct schematic sites");
      const trapChanges = ["A", "B"].filter(
        (atom) => previous[atom].trap !== next[atom].trap,
      ).length;
      assert.equal(next.transfers - previous.transfers, trapChanges);
      for (const atom of ["A", "B"])
        if (previous[atom].site !== next[atom].site)
          assert.equal(next[atom].trap, "AOD", "only an AOD-held atom is transported");
    }
  }
});

test("Appendix A distance accounting matches 24 µm for CZ and 32 µm for CZSWAP", () => {
  const cz = TRANSPORT_STAGES.cz.at(-1),
    swap = TRANSPORT_STAGES.czswap.at(-1);
  assert.equal(cz.transfers, 2);
  assert.equal(swap.transfers, 4);
  assert.equal(cz.bigMoves, 2);
  assert.equal(swap.bigMoves, 2);
  assert.equal(cz.offsetMoves, 0);
  assert.equal(swap.offsetMoves, 4);
  assert.equal(transportDistance(cz), 24);
  assert.equal(transportDistance(swap), 32);
  assert.equal(2 * transportDistance(cz), 48, "two independently executed CZ gates in a DCNOT");
});

test("Figures 7 and 8 retain source page, caption and reviewed image identity", () => {
  const slug = "optimizing-atom-transport-gate-count-and-depth-with";
  const folder = `papers/${slug}`;
  const json = (name) => JSON.parse(readFileSync(`${folder}/${name}.json`, "utf8"));
  const { parsePaper } = loadModule("src/lib/papers.ts");
  const structure = json("structure");
  const parse = (data) =>
    parsePaper(slug, json("meta"), json("paragraphs"), json("concepts"), data, {});
  const figures = parse(structure).structure.figures;
  assert.deepEqual(
    figures.map((f) => [f.id, f.page, f.captionParagraph, f.animation]),
    [
      ["figure-2", 1, "p0018", "parity-twine"],
      ["figure-7", 10, "p0127", "oqft-blocks"],
      ["figure-8", 15, "p0227", "atom-transport"],
    ],
  );
  verifyFigureImages(folder);
  assert.throws(
    () => parse({ ...structure, figures: [{ ...figures[1], animation: "unknown" }] }),
    /figure/,
  );
});
