import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadModule, memoryStorage, flush } from "./helpers/modules.mjs";

test("review distinguishes a temporary load failure from a missing card and can retry", async () => {
  const card = { id: "demo:paragraph:p1", slug: "demo", kind: "paragraph", refId: "p1", variant: "it-beginner", due: "2000-01-01T00:00:00Z" };
  const requests = [];
  const { default: Review } = loadModule("src/pages/Review.tsx", {
    globals: { window: new EventTarget(), localStorage: memoryStorage() },
    mocks: {
      "react-router-dom": { useSearchParams: () => [new URLSearchParams()], Link: (p) => React.createElement("a", p) },
      [resolve("src/lib/review.ts")]: { useReview: () => ({ cards: { [card.id]: card } }), isDue: () => true },
      [resolve("src/lib/papers.ts")]: { loadPaper: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Review)); });
  await act(async () => { requests[0].reject(new Error("network offline")); await flush(); });
  assert.equal(tree.root.findAllByProps({ role: "alert" }).length, 1);
  assert.equal(tree.root.findAllByType("button").some((b) => b.children.includes("Rimuovi dal ripasso")), false);
  await act(async () => { tree.root.findAllByType("button").find((b) => b.children.includes("Riprova")).props.onClick(); });
  assert.equal(requests.length, 2);
  await act(async () => { requests[1].resolve({
    meta: { title: "Demo", variants: [] }, paragraphs: [{ id: "p1", sourceText: "source", explanations: { "it-beginner": "answer" } }], concepts: [], numbers: new Map([["p1", 1]]),
  }); await flush(); });
  assert.equal(tree.root.findAllByProps({ role: "alert" }).length, 0);
  assert.equal(tree.root.findAllByType("button").some((b) => b.children[0] === "Mostra risposta "), true);
  await act(async () => tree.unmount());
});
