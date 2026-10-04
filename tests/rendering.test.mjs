import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadModule, flush } from "./helpers/modules.mjs";

test("pages outside the render window release canvases and do not redraw on zoom", async () => {
  let observer;
  let renders = 0;
  let pageRequests = 0;
  let finishMeasuring;
  const measurement = new Promise((resolve) => { finishMeasuring = resolve; });
  const node = { closest: () => null, style: {}, getContext: () => ({}) };
  const page = { getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }), render: () => { renders++; return { promise: Promise.resolve(), cancel() {} }; } };
  const { default: PageCanvas } = loadModule("src/components/PageCanvas.tsx", {
    globals: { window: { devicePixelRatio: 2 }, IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() {} } },
    mocks: Object.fromEntries(["ParagraphOverlay", "AnnotationLayer", "TextLayer", "LinkLayer"].map((name) => [resolve(`src/components/${name}.tsx`), { default: () => null }])),
  });
  const props = { doc: { getPage: async () => (++pageRequests === 1 ? measurement : page) }, pageNumber: 1, scale: 1, defaultSize: { width: 100, height: 200 }, paragraphs: [], numbers: new Map(), annotations: [] };
  let tree;
  await act(async () => { tree = create(React.createElement(PageCanvas, props), { createNodeMock: () => node }); await flush(); });
  assert.equal(tree.root.findAllByType("canvas").length, 0);
  assert.deepEqual({ ...tree.root.findByProps({ id: "page-1" }).props.style }, { width: 100, height: 200 });
  await act(async () => { finishMeasuring(page); await flush(); });
  await act(async () => { observer([{ target: node, isIntersecting: true }]); await flush(); });
  assert.equal(renders, 1);
  await act(async () => { observer([{ target: node, isIntersecting: false }]); await flush(); });
  assert.equal(tree.root.findAllByType("canvas").length, 0);
  await act(async () => tree.update(React.createElement(PageCanvas, { ...props, scale: 2 })));
  assert.equal(renders, 1);
  assert.equal(pageRequests, 2);
  assert.deepEqual({ ...tree.root.findByProps({ id: "page-1" }).props.style }, { width: 200, height: 400 });
  await act(async () => { observer([{ target: node, isIntersecting: true }]); await flush(); });
  assert.equal(renders, 2);
  await act(async () => tree.unmount());
});

test("Retina rendering at high zoom is bounded to 16 million canvas pixels", async () => {
  let observer;
  const node = { closest: () => null, style: {}, getContext: () => ({}) };
  const page = { getViewport: () => ({ width: 6000, height: 9000 }), render: () => ({ promise: Promise.resolve(), cancel() {} }) };
  const { default: PageCanvas } = loadModule("src/components/PageCanvas.tsx", {
    globals: { window: { devicePixelRatio: 3 }, IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() {} } },
    mocks: Object.fromEntries(["ParagraphOverlay", "AnnotationLayer", "TextLayer", "LinkLayer"].map((name) => [resolve(`src/components/${name}.tsx`), { default: () => null }])),
  });
  let tree;
  await act(async () => { tree = create(React.createElement(PageCanvas, { doc: { getPage: async () => page }, pageNumber: 1, scale: 4 }), { createNodeMock: () => node }); });
  await act(async () => { observer([{ target: node, isIntersecting: true }]); await flush(); });
  assert.ok(node.width * node.height <= 16_000_000);
  assert.equal(node.style.width, "6000px");
  await act(async () => tree.unmount());
});
