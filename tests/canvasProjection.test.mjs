import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CANVAS_PRESETS,
  canvasOffset,
  firstAppearance,
  placeContinuous,
  positionIds,
  rasterize,
  readableFirstAppearance,
  seamSplitObjects,
  sphericalCoordinates,
} from "../src/lib/canvasProjection.ts";
import { verifyFigureImages } from "../scripts/figure-data.mjs";
import { loadModule } from "./helpers/modules.mjs";

const pose = (id) => CANVAS_PRESETS.find((p) => p.id === id).pose;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("OneCanvas angles follow §3.2: θ = atan2(qx, qz), φ = arctan(−qy / r_xz), ids in [0, 100]", () => {
  const q = canvasOffset([2, -0.5, 2], { x: 0, z: 0, yaw: 0 });
  const { theta, phi } = sphericalCoordinates(q);
  close(theta, 45);
  close(phi, (Math.atan(0.5 / Math.sqrt(8)) * 180) / Math.PI);
  assert.deepEqual(positionIds(-180, -90), { w: 0, h: 0 });
  assert.deepEqual(positionIds(180, 90), { w: 100, h: 100 });
  close(positionIds(theta, 0).w, 62.5);
  // Points on one ray share their angles; only the radius tells them apart.
  const far = sphericalCoordinates(canvasOffset([4, -1, 4], { x: 0, z: 0, yaw: 0 }));
  close(far.theta, theta);
  close(far.phi, phi);
  // The canvas forward axis has θ = 0 and its right side θ = +90° for any yaw.
  for (const yaw of [-120, 0, 15, 90]) {
    const a = (yaw * Math.PI) / 180;
    close(
      sphericalCoordinates(canvasOffset([Math.sin(a), 0, Math.cos(a)], { x: 0, z: 0, yaw })).theta,
      0,
    );
    close(
      sphericalCoordinates(canvasOffset([Math.cos(a), 0, -Math.sin(a)], { x: 0, z: 0, yaw })).theta,
      90,
    );
  }
});

test("continuous placement keeps every patch, including co-located observations", () => {
  const tokens = placeContinuous(pose("centre"));
  assert.equal(tokens.length, 14);
  const table = tokens.filter((t) => t.objects[0] === "table");
  const basket = tokens.filter((t) => t.objects[0] === "basket");
  // The table and the basket on the floor behind it lie on one viewing ray from the centre.
  close(table[0].theta, basket[0].theta);
  assert.ok(basket[0].radius > table[0].radius);
  assert.deepEqual(readableFirstAppearance(tokens), firstAppearance());
});

test("rasterization pools cells and loses a first appearance, as in App. B.2", () => {
  const continuous = placeContinuous(pose("centre"));
  for (const cell of [10, 30]) {
    const pooled = rasterize(continuous, cell);
    assert.ok(pooled.length < continuous.length);
    assert.equal(
      pooled.reduce((s, t) => s + t.patches, 0),
      continuous.length,
    );
    const mixed = pooled.find((t) => t.objects.includes("table"));
    assert.deepEqual(mixed.objects, ["basket", "table"]);
    assert.equal(
      readableFirstAppearance(pooled).get("table") > firstAppearance().get("table"),
      true,
    );
  }
});

test("the longitude seam splits the door only when it lies behind the canvas origin", () => {
  assert.deepEqual([...seamSplitObjects(placeContinuous(pose("centre")))].sort(), ["door", "sofa"]);
  assert.equal(seamSplitObjects(placeContinuous(pose("agent"))).size, 0);
  assert.equal(
    seamSplitObjects(placeContinuous({ ...pose("centre"), yaw: 90 })).has("door"),
    false,
  );
});

test("OneCanvas figures retain source pages, captions and reviewed crops", () => {
  const slug = "onecanvas-3d-scene-understanding-via-panoramic-reprojection";
  const folder = `papers/${slug}`;
  const json = (name) => JSON.parse(readFileSync(`${folder}/${name}.json`, "utf8"));
  const { parsePaper } = loadModule("src/lib/papers.ts");
  const figures = parsePaper(
    slug,
    json("meta"),
    json("paragraphs"),
    json("concepts"),
    json("structure"),
    {},
  ).structure.figures;
  assert.deepEqual(
    figures.map((f) => [f.id, f.page, f.captionParagraph, f.animation]),
    [
      ["figure-1", 0, "p0000", "canvas-projection"],
      ["figure-2", 1, "p0002", undefined],
      ["figure-3", 3, "p0010", undefined],
      ["figure-4", 6, "p0024", undefined],
    ],
  );
  verifyFigureImages(folder);
});
