import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/modules.mjs";

function setup(contents) {
  const spans = contents.map((text) => ({ tagName: "SPAN", textContent: text, scrollIntoView() {} }));
  const ranges = [], markers = [];
  const layer = { dataset: { rendered: "true" }, querySelectorAll: () => spans };
  const page = { isConnected: true, scrollIntoView() {}, querySelector: () => layer,
    getBoundingClientRect: () => ({ left: 10, top: 20 }), append: (marker) => markers.push(marker) };
  const document = {
    getElementById: () => page, querySelectorAll: () => [],
    createTreeWalker: (span) => { let seen = false; return { nextNode() { if (seen) return null; seen = true; return span; } }; },
    createRange: () => {
      const range = { setStart(node, offset) { this.start = { node, offset }; }, setEnd(node, offset) { this.end = { node, offset }; },
        getClientRects() { return [{ left: 25, top: 35, width: this.end.offset - this.start.offset, height: 8 }]; } };
      ranges.push(range); return range;
    },
    createElement: () => ({ style: {}, scrollIntoView() {}, remove() { this.removed = true; } }),
  };
  const { highlightMatchInDom } = loadModule("src/lib/search.ts", { globals: { document, NodeFilter: { SHOW_TEXT: 4 }, setTimeout() {} } });
  return { highlightMatchInDom, ranges, markers };
}

test("highlighting selects the second occurrence inside a single span and abort removes its marker", async () => {
  const { highlightMatchInDom, ranges, markers } = setup(["atom atom"]);
  const controller = new AbortController();
  await highlightMatchInDom({ page: 1, start: 5, end: 9 }, "atom", controller.signal);
  assert.equal(ranges[0].start.offset, 5);
  assert.equal(ranges[0].end.offset, 9);
  assert.equal(markers[0].style.left, "15px");
  controller.abort();
  assert.equal(markers[0].removed, true);
});

test("a phrase across spans highlights the exact local range in both spans", async () => {
  const { highlightMatchInDom, ranges } = setup(["a neutral ", "atom model"]);
  await highlightMatchInDom({ page: 1, start: 2, end: 14 }, "neutral atom");
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].start.offset, 2);
  assert.equal(ranges[0].end.offset, 10);
  assert.equal(ranges[1].start.offset, 0);
  assert.equal(ranges[1].end.offset, 4);
});
