// Copies papers/ (the skill's data output, source of truth) into public/papers/
// so the static build in dist/ is self-contained for GH Pages.
import { cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "papers");
const dest = join(root, "public", "papers");

rmSync(dest, { recursive: true, force: true });
if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
}
