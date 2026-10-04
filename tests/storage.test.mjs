import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadModule, memoryStorage } from "./helpers/modules.mjs";

const { UserDataStore, USER_DATA_KEY, LEGACY_REVIEW_KEY, ANNOTATIONS_PREFIX } = loadModule("src/lib/userData.ts");
const note = { id: "n1", page: 0, type: "text", color: "#ff0000", createdAt: "2026-10-01T00:00:00Z", x: 0.2, y: 0.3, text: "first" };
const data = (text) => ({ review: {}, annotations: { demo: [{ ...note, text }] } });
const envelope = (value) => JSON.stringify({ version: 2, ...value });

test("legacy annotations migrate with one write and original keys remain recoverable", () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_REVIEW_KEY, "{}");
  storage.setItem(ANNOTATIONS_PREFIX + "demo", JSON.stringify([note]));
  const store = new UserDataStore(() => storage);
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "first");
  store.update(() => data("edited"));
  assert.equal(JSON.parse(storage.getItem(USER_DATA_KEY)).annotations.demo[0].text, "edited");
  assert.equal(JSON.parse(storage.getItem(ANNOTATIONS_PREFIX + "demo"))[0].text, "first");
});

test("failed saves keep work in memory, notify subscribers and can be retried", () => {
  const storage = memoryStorage();
  storage.setItem(USER_DATA_KEY, envelope(data("first")));
  let unavailable = true;
  const guarded = { ...storage, setItem(key, value) { if (unavailable) throw new Error("QuotaExceededError"); storage.setItem(key, value); } };
  const store = new UserDataStore(() => guarded);
  let a = 0, b = 0;
  store.subscribe(() => a++); store.subscribe(() => b++);
  store.update(() => data("unsaved"));
  assert.equal(store.getSnapshot().unsaved, true);
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "unsaved");
  assert.equal(JSON.parse(storage.getItem(USER_DATA_KEY)).annotations.demo[0].text, "first");
  assert.equal(a, 1); assert.equal(b, 1);
  store.reload();
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "unsaved");
  unavailable = false;
  store.retry();
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().unsaved, false);
  assert.equal(JSON.parse(storage.getItem(USER_DATA_KEY)).annotations.demo[0].text, "unsaved");
});

test("a failed import changes neither the existing disk envelope nor in-memory data", () => {
  const storage = memoryStorage();
  const original = envelope(data("first"));
  storage.setItem(USER_DATA_KEY, original);
  const store = new UserDataStore(() => ({ ...storage, setItem() { throw new Error("QuotaExceededError"); } }));
  assert.throws(() => store.update(() => data("imported"), true), /Importazione annullata/);
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "first");
  assert.equal(storage.getItem(USER_DATA_KEY), original);
});

test("corrupt saved data is preserved and mutations stay blocked until a successful reread", () => {
  const storage = memoryStorage();
  storage.setItem(USER_DATA_KEY, "{corrupt");
  const store = new UserDataStore(() => storage);
  assert.equal(store.getSnapshot().readFailed, true);
  store.update(() => data("overwrite"));
  assert.equal(storage.getItem(USER_DATA_KEY), "{corrupt");
  assert.throws(() => store.update(() => data("overwrite"), true), /Importazione annullata/);
  storage.setItem(USER_DATA_KEY, envelope(data("recovered")));
  store.retry();
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "recovered");
});

test("an update reads a newer envelope written by another tab before applying its mutation", () => {
  const storage = memoryStorage();
  const store = new UserDataStore(() => storage);
  store.getSnapshot();
  storage.setItem(USER_DATA_KEY, envelope(data("other tab")));
  store.update((current) => ({ ...current, annotations: { ...current.annotations, second: [note] } }));
  assert.equal(store.getSnapshot().data.annotations.demo[0].text, "other tab");
  assert.equal(store.getSnapshot().data.annotations.second.length, 1);
});

test("annotation hooks in the same tab synchronize and a slug change never exposes old notes", async () => {
  const storage = memoryStorage();
  const window = new EventTarget();
  const { useAnnotations } = loadModule("src/lib/annotations.ts", { globals: { localStorage: storage, window } });
  const hooks = {};
  function Consumer({ name, slug }) { hooks[name] = useAnnotations(slug); return null; }
  const children = (slug) => React.createElement(React.Fragment, null,
    React.createElement(Consumer, { name: "a", slug }), React.createElement(Consumer, { name: "b", slug }));
  let tree;
  await act(async () => { tree = create(children("demo")); });
  await act(async () => { hooks.a.addAnnotation(note); });
  assert.equal(hooks.b.annotations.length, 1);
  await act(async () => { hooks.b.updateAnnotation("n1", { text: "synced" }); });
  assert.equal(hooks.a.annotations[0].text, "synced");
  assert.ok(hooks.a.annotations[0].updatedAt);
  await act(async () => {
    storage.setItem(USER_DATA_KEY, envelope(data("another tab")));
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: USER_DATA_KEY });
    window.dispatchEvent(event);
  });
  assert.equal(hooks.a.annotations[0].text, "another tab");
  assert.equal(hooks.b.annotations[0].text, "another tab");
  await act(async () => { tree.update(children("other")); });
  assert.equal(hooks.a.annotations.length, 0);
  await act(async () => { tree.unmount(); });
});
