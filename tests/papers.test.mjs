import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadModule, flush } from "./helpers/modules.mjs";

const variant = { key: "it-beginner", language: "it", level: "beginner", label: "Italiano" };
const meta = { slug: "demo", title: "Demo", authors: [], pageCount: 2, variants: [variant] };
const paragraph = { id: "p1", page: 0, order: 0, rects: [[0.1, 0.1, 0.8, 0.2]], sourceText: "A passage", explanations: { "it-beginner": "Una spiegazione" } };
const { parsePaper } = loadModule("src/lib/papers.ts");

test("the loader accepts every existing paper without converting or renumbering its data", () => {
  const json = (path) => JSON.parse(readFileSync(path, "utf8"));
  const index = json("papers/concepts-index.json");
  for (const { slug } of json("papers/index.json")) {
    const paper = parsePaper(slug, json(`papers/${slug}/meta.json`), json(`papers/${slug}/paragraphs.json`), json(`papers/${slug}/concepts.json`), json(`papers/${slug}/structure.json`), index);
    assert.equal(paper.numbers.size, paper.paragraphs.length);
  }
});

test("a logical passage renders hit areas on every anchor page under the same stable ID", () => {
  const anchors = [{ page: 0, rects: paragraph.rects }, { page: 1, rects: [[0.2, 0.1, 0.9, 0.3]] }];
  const p = { ...paragraph, anchors };
  const parsed = parsePaper("demo", meta, [p], [], null, {});
  const { paragraphsByPage } = loadModule("src/lib/paragraphs.ts");
  const pages = paragraphsByPage(parsed.paragraphs);
  assert.equal(pages.size, 2);
  assert.equal(pages.get(1)[0].id, "p1");
  assert.equal(pages.get(1)[0].rects[0][0], 0.2);
  assert.equal(parsed.numbers.size, 1);
  assert.throws(() => parsePaper("demo", meta, [{ ...p, page: 1 }], [], null, {}), /first anchor/);
  assert.throws(() => parsePaper("demo", meta, [{ ...p, anchors: [...anchors, { page: 2, rects: paragraph.rects }] }], [], null, {}), /coordinates/);
});

function setup() {
  const requests = [];
  const { createPaperLoader } = loadModule("src/lib/papers.ts", { globals: {
    fetch: (url, { signal }) => new Promise((resolve, reject) => {
      requests.push({ url, signal, resolve, reject });
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  } });
  const complete = (status = 200) => requests.filter((r) => !r.signal.aborted).forEach((r) => r.resolve({
    status, ok: status === 200, headers: { get: () => "application/json" },
    json: async () => r.url.endsWith("meta.json") ? meta : r.url.endsWith("paragraphs.json") ? [paragraph] : r.url.endsWith("structure.json") ? null : r.url.endsWith("concepts.json") ? [] : {},
  }));
  return { load: createPaperLoader(), requests, complete };
}

test("concurrent readers share a load and cancellation affects only that consumer", async () => {
  const { load, requests, complete } = setup();
  const abort = new AbortController();
  const first = load("demo", abort.signal);
  const second = load("demo");
  assert.equal(requests.length, 5);
  const rejected = assert.rejects(first, { name: "AbortError" });
  abort.abort();
  assert.equal(requests.some((r) => r.signal.aborted), false);
  complete();
  await rejected;
  const data = await second;
  assert.equal((await load("demo")), data);
  assert.equal(requests.length, 5);
});

test("cancelling the final consumer aborts requests and a later visit loads afresh", async () => {
  const { load, requests, complete } = setup();
  const controller = new AbortController();
  const first = load("demo", controller.signal);
  const rejected = assert.rejects(first, { name: "AbortError" });
  controller.abort();
  await rejected;
  await flush();
  assert.equal(requests.every((r) => r.signal.aborted), true);
  const second = load("demo");
  assert.equal(requests.length, 10);
  complete();
  assert.equal((await second).meta.slug, "demo");
});

test("failed downloads are not cached and can be retried", async () => {
  const { load, requests, complete } = setup();
  const first = load("demo");
  complete(500);
  await assert.rejects(first, /500/);
  const second = load("demo");
  assert.equal(requests.length, 10);
  complete();
  assert.equal((await second).paragraphs.length, 1);
});

test("optional data tolerates a missing SPA file but surfaces an HTML server error", async () => {
  for (const status of [200, 404, 500]) {
    const { load, requests, complete } = setup();
    const result = load("demo");
    requests.find((r) => r.url.endsWith("structure.json")).resolve({
      status, ok: status === 200, headers: { get: () => "text/html" },
      json: async () => { throw new Error("HTML is not JSON"); },
    });
    complete();
    if (status === 500) await assert.rejects(result, /structure\.json: 500/);
    else assert.equal((await result).structure, null);
  }
});
