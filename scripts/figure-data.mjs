import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Check checked-in crops without a Python renderer or any network access. */
export function verifyFigureImages(folder) {
  const structure = JSON.parse(readFileSync(join(folder, "structure.json"), "utf8"));
  const figures = structure.figures ?? [];
  if (!figures.length) return;
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const digest = hash(readFileSync(join(folder, "source/paper.pdf")));
  for (const figure of figures) {
    if (!/^figures\/[a-z0-9][a-z0-9-]*\.png$/.test(figure.image))
      throw new Error(`${folder}/${figure.id}: invalid figure image path`);
    if (figure.sourceSha256 !== digest)
      throw new Error(`${folder}/${figure.id}: original PDF changed; review the figure`);
    const stamp = readFileSync(
      join(folder, figure.image.replace(/\.png$/, ".sha256")),
      "utf8",
    ).trim();
    const expected = hash(JSON.stringify([digest, figure.page, figure.rect, 1200]));
    if (stamp !== expected)
      throw new Error(`${folder}/${figure.id}: crop changed; run uv run scripts/render-figures.py`);
    const image = readFileSync(join(folder, figure.image));
    if (
      image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      image.readUInt32BE(16) < 1200
    )
      throw new Error(`${folder}/${figure.id}: missing or invalid 1200px PNG crop`);
  }
}
