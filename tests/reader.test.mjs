import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadModule, flush } from "./helpers/modules.mjs";

test("a late response from the previous paper cannot replace the current paper", async () => {
  let slug = "a";
  const requests = [];
  const fetch = (url) => new Promise((fulfill) => requests.push({ url, fulfill }));
  const { default: Reader } = loadModule("src/pages/Reader.tsx", {
    globals: { fetch },
    mocks: {
      "react-router-dom": { useParams: () => ({ slug }), useSearchParams: () => [new URLSearchParams()], useLocation: () => ({ state: null }), Link: (props) => React.createElement("a", props) },
      [resolve("src/lib/annotations.ts")]: { useAnnotations: () => ({ annotations: [] }) },
      [resolve("src/components/PdfViewer.tsx")]: { default: (props) => React.createElement("viewer", props) },
    },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Reader)); });
  slug = "b";
  await act(async () => tree.update(React.createElement(Reader)));
  async function finish(wanted) {
    for (const request of requests.filter((r) => r.url.includes(`/${wanted}/`) || r.url.endsWith("concepts-index.json"))) {
      const meta = { slug: wanted, title: wanted, authors: [], pageCount: 1, variants: [{ key: "it-beginner", language: "it", level: "beginner", label: "Italiano" }] };
      const data = request.url.endsWith("meta.json") ? meta : request.url.endsWith("structure.json") ? { thesis: { "it-beginner": "Tesi" }, claims: [] } : request.url.endsWith("concepts-index.json") ? {} : [];
      request.fulfill({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => data });
    }
    await flush();
  }
  await act(async () => finish("b"));
  assert.equal(tree.root.findByType("viewer").props.title, "b");
  await act(async () => finish("a"));
  assert.equal(tree.root.findByType("viewer").props.title, "b");
  await act(async () => tree.unmount());
});
