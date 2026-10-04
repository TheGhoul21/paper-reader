import assert from "node:assert/strict";
import test from "node:test";
import { loadModule, memoryStorage } from "./helpers/modules.mjs";

const key = "paper-reader:review";
const card = {
  id: "demo:paragraph:p1",
  slug: "demo",
  kind: "paragraph",
  refId: "p1",
  variant: "it-beginner",
  addedAt: "2026-09-01T10:00:00.000Z",
  due: "2026-11-01T10:00:00.000Z",
  interval: 30,
  ease: 2.5,
  reps: 8,
  lapses: 0,
};
function setup() {
  const storage = memoryStorage();
  const window = new EventTarget();
  const backup = loadModule("src/lib/backup.ts", { globals: { localStorage: storage, window } });
  return { storage, ...backup };
}

test("an old backup does not replace a more recent failed recall", () => {
  const { storage, importBackup, exportBackup } = setup();
  const recent = {
    ...card,
    reps: 0,
    interval: 0,
    lapses: 1,
    due: "2026-10-03T10:10:00.000Z",
    updatedAt: "2026-10-03T10:00:00.000Z",
  };
  storage.setItem(key, JSON.stringify({ [card.id]: recent }));
  importBackup({ app: "paper-reader", version: 1, review: { [card.id]: card }, annotations: {} });
  assert.equal(exportBackup().review[card.id].due, recent.due);
});

test("a malformed backup fails before writing any part of it", () => {
  const { storage, importBackup } = setup();
  storage.setItem(key, JSON.stringify({ [card.id]: card }));
  const original = storage.getItem(key);
  assert.throws(() =>
    importBackup({
      app: "paper-reader",
      version: 1,
      review: { bad: {} },
      annotations: { demo: null },
    }),
  );
  assert.equal(storage.getItem(key), original);
  assert.equal(storage.length, 1);
  assert.throws(() =>
    importBackup({ app: "paper-reader", version: 1, review: {}, annotations: null }),
  );
  assert.throws(() => importBackup({ app: "paper-reader", version: 1, review: {} }));
});

test("newer timestamps win for cards and annotations independently of repetition count", () => {
  const { importBackup, exportBackup } = setup();
  const annotation = {
    id: "n1",
    page: 0,
    type: "text",
    color: "#ff0000",
    createdAt: card.addedAt,
    x: 0.1,
    y: 0.2,
    text: "old",
    updatedAt: "2026-10-01T00:00:00Z",
  };
  const backup = (review, note) => ({
    app: "paper-reader",
    version: 1,
    review: { [card.id]: review },
    annotations: { demo: [note] },
  });
  importBackup(backup({ ...card, updatedAt: annotation.updatedAt }, annotation));
  const timestamp = "2026-10-03T00:00:00Z";
  importBackup(
    backup(
      { ...card, reps: 0, updatedAt: timestamp },
      { ...annotation, text: "new", updatedAt: timestamp },
    ),
  );
  const result = exportBackup();
  assert.equal(result.review[card.id].reps, 0);
  assert.equal(result.annotations.demo[0].text, "new");
  importBackup(backup(card, annotation));
  assert.equal(exportBackup().annotations.demo[0].text, "new");
});

test("reading positions and preferences round-trip without a legacy backup erasing them", () => {
  const { importBackup, exportBackup } = setup();
  const current = {
    page: 5,
    paragraphId: "p1",
    variant: "it-beginner",
    updatedAt: "2026-10-04T10:00:00Z",
  };
  const preferences = { fontSize: 18, panelWidth: 440 };
  importBackup({
    app: "paper-reader",
    version: 1,
    review: {},
    annotations: {},
    reading: { demo: current },
    preferences,
  });
  importBackup({ app: "paper-reader", version: 1, review: {}, annotations: {} });
  assert.deepEqual({ ...exportBackup().reading.demo }, current);
  assert.deepEqual({ ...exportBackup().preferences }, preferences);
  importBackup({
    app: "paper-reader",
    version: 1,
    review: {},
    annotations: {},
    reading: { demo: { ...current, page: 2, updatedAt: "2026-10-01T00:00:00Z" } },
  });
  assert.equal(exportBackup().reading.demo.page, 5);
});

test("guided progress survives old backups, conflicts and an actual storage reload", () => {
  const { storage, importBackup } = setup();
  const journey = {
    phase: "summary",
    stepId: "stable-step",
    variant: "it-beginner",
    explored: ["stable-step"],
    doubts: ["stable-step"],
    reflection: "Una sintesi",
    scrollY: 520,
    updatedAt: "2026-10-04T12:00:00Z",
  };
  const backup = (journeys) => ({
    app: "paper-reader",
    version: 1,
    review: {},
    annotations: {},
    journeys,
  });
  importBackup(backup({ demo: journey }));
  importBackup(backup(undefined));
  importBackup(
    backup({
      demo: { ...journey, reflection: "Vecchia sintesi", updatedAt: "2026-10-01T12:00:00Z" },
    }),
  );
  // A fresh module reads the version-2 storage envelope, rather than its in-memory snapshot.
  const reloaded = loadModule("src/lib/backup.ts", {
    globals: { localStorage: storage, window: new EventTarget() },
  });
  const exported = reloaded.exportBackup();
  assert.equal(exported.version, 1);
  assert.deepEqual(
    {
      ...exported.journeys.demo,
      explored: [...exported.journeys.demo.explored],
      doubts: [...exported.journeys.demo.doubts],
    },
    journey,
  );
  reloaded.importBackup(exported);
});

test("invalid guided progress cannot partly replace existing user work", () => {
  const { storage, importBackup } = setup();
  const journey = {
    phase: "reading",
    stepId: "s1",
    variant: "it-beginner",
    explored: ["s1"],
    doubts: [],
    reflection: "Conservami",
    scrollY: 0,
    updatedAt: "2026-10-04T12:00:00Z",
  };
  const backup = (change) => ({
    app: "paper-reader",
    version: 1,
    review: {},
    annotations: {},
    journeys: { demo: { ...journey, ...change } },
  });
  importBackup(backup({}));
  const original = storage.getItem("paper-reader:user-data");
  for (const change of [
    { doubts: ["unseen"] },
    { explored: ["s1", "s1"] },
    { scrollY: -1 },
    { reflection: null },
    { phase: "mastered" },
  ]) {
    assert.throws(() => importBackup(backup(change)), /Percorso/);
    assert.equal(storage.getItem("paper-reader:user-data"), original);
  }
});
