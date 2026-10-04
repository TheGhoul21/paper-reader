import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/modules.mjs";

const { newGuidedProgress, updateGuidedProgress, guidedStops, explainedPageCount } = loadModule(
  "src/lib/guidedReading.ts",
);

test("recording a doubt advances atomically and a later clear reading removes only that doubt", () => {
  const initial = {
    ...newGuidedProgress("first", "it-beginner"),
    reflection: "La mia idea",
    doubts: ["older"],
    explored: ["older"],
  };
  const next = updateGuidedProgress(initial, {
    type: "continue",
    stepId: "first",
    nextStepId: "second",
    doubt: true,
    variant: "it-beginner",
  });
  assert.equal(next.stepId, "second");
  assert.equal(next.phase, "reading");
  assert.deepEqual([...next.doubts], ["older", "first"]);
  assert.deepEqual([...next.explored], ["older", "first"]);
  const clear = updateGuidedProgress(next, {
    type: "continue",
    stepId: "first",
    nextStepId: "second",
    doubt: false,
    variant: "it-expert",
  });
  assert.deepEqual([...clear.doubts], ["older"]);
  assert.deepEqual([...clear.explored], ["older", "first"]);
  assert.equal(clear.reflection, initial.reflection);
  assert.equal(clear.variant, "it-expert");
});

test("finishing and returning to a step preserves reflection and all previous exploration", () => {
  const initial = {
    ...newGuidedProgress("last", "it-beginner"),
    reflection: "Il risultato",
    explored: ["first"],
  };
  const final = updateGuidedProgress(initial, {
    type: "continue",
    stepId: "last",
    nextStepId: null,
    doubt: true,
    variant: initial.variant,
  });
  assert.equal(final.phase, "summary");
  const revisited = updateGuidedProgress(final, {
    type: "open",
    stepId: "first",
    phase: "reading",
    variant: initial.variant,
  });
  assert.equal(revisited.reflection, initial.reflection);
  assert.deepEqual([...revisited.explored], ["first", "last"]);
  assert.deepEqual([...revisited.doubts], ["last"]);
});

test("a delayed scroll from another step or phase cannot overwrite a new destination", () => {
  const initial = { ...newGuidedProgress("second", "it-beginner"), scrollY: 200 };
  assert.equal(
    updateGuidedProgress(initial, { type: "scroll", stepId: "first", phase: "reading", y: 900 }),
    initial,
  );
  assert.equal(
    updateGuidedProgress(initial, { type: "scroll", stepId: "second", phase: "summary", y: 900 }),
    initial,
  );
  assert.equal(
    updateGuidedProgress(initial, { type: "scroll", stepId: "second", phase: "reading", y: 400 })
      .scrollY,
    400,
  );
});

test("guide order uses stable references while page presence counts every anchor exactly once", () => {
  const paragraphs = [
    { id: "a", page: 0, anchors: [{ page: 0 }, { page: 1 }] },
    { id: "b", page: 1 },
  ];
  const section = { id: "section", steps: [{ id: "first", paragraphs: ["b", "a"] }] };
  const stops = guidedStops({ paragraphs, structure: { readingGuide: [section] } });
  assert.equal(stops[0].step.id, "first");
  assert.deepEqual(
    stops[0].paragraphs.map((p) => p.id),
    ["b", "a"],
  );
  assert.equal(explainedPageCount(paragraphs), 2);
});
