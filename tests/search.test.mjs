import assert from "node:assert/strict";
import test from "node:test";
import { findMatches } from "../src/lib/search.ts";
import { normalizeSearchText, pageText } from "../src/lib/pdfText.ts";

const doc = { numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "neutral " }, { str: "atom atom" }] }) }) };
test("search finds a phrase split across PDF text items", async () => {
  assert.equal((await findMatches(doc, "neutral atom")).length, 1);
});
test("search counts every occurrence within the same PDF text item", async () => {
  assert.equal((await findMatches(doc, "atom")).length, 2);
});

test("search normalizes ligatures and broken lines while retaining exact source ranges", async () => {
  const source = "The efﬁcient neutral-\natom\u00ad system. x -\ny";
  const normalized = normalizeSearchText(source);
  assert.equal(normalized.text, "the efficient neutralatom system. x - y");
  const pdf = { numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: source }] }) }) };
  const [hit] = await findMatches(pdf, "efficient");
  assert.equal(source.slice(hit.start, hit.end), "efﬁcient");
  const [acrossLine] = await findMatches(pdf, "neutralatom");
  assert.equal(source.slice(acrossLine.start, acrossLine.end), "neutral-\natom");
});

test("successive queries reuse the extracted page text", async () => {
  let reads = 0;
  const pdf = { numPages: 1, getPage: async () => ({ getTextContent: async () => { reads++; return { items: [{ str: "atom atom" }] }; } }) };
  const [a, b] = await Promise.all([findMatches(pdf, "atom"), findMatches(pdf, "ATOM")]);
  assert.equal(a.length, 2); assert.equal(b.length, 2);
  assert.equal(reads, 1);
});

test("failed text extraction can be retried", async () => {
  let reads = 0;
  const pdf = { getPage: async () => ({ getTextContent: async () => { if (++reads === 1) throw new Error("temporary"); return { items: [{ str: "atom" }] }; } }) };
  await assert.rejects(pageText(pdf, 1), /temporary/);
  assert.equal(await pageText(pdf, 1), "atom");
});

test("obsolete searches stop before scanning the next page", async () => {
  const controller = new AbortController();
  let reads = 0;
  const pdf = { numPages: 3, getPage: async () => ({ getTextContent: async () => { reads++; controller.abort(); return { items: [{ str: "atom" }] }; } }) };
  await assert.rejects(findMatches(pdf, "atom", controller.signal), { name: "AbortError" });
  assert.equal(reads, 1);
});
