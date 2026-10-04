import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Explicit sequence, usable by a maintainer and by CI. Never edits the source data.
const papers = JSON.parse(readFileSync("papers/index.json", "utf8"));
for (const { slug } of papers) {
  for (const [command, args] of [
    [
      "python3",
      [".claude/skills/import-paper/scripts/check_paper.py", slug, "--require-reading-guide"],
    ],
    [
      "node",
      [
        "--experimental-strip-types",
        "--no-warnings",
        ".claude/skills/import-paper/scripts/check_concepts.mjs",
        slug,
      ],
    ],
    [
      "node",
      [
        "--experimental-strip-types",
        "--no-warnings",
        ".claude/skills/import-paper/scripts/check_deep_dives.mjs",
        slug,
      ],
    ],
  ]) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      console.error(result.error ?? `${command} failed for ${slug}`);
      console.error(result.stdout, result.stderr);
      process.exit(1);
    }
  }
  console.log(`${slug}: OK`);
}
console.log(`Validated ${papers.length} papers.`);
