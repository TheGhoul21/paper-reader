import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, statSync, createReadStream } from "node:fs";
import { join, normalize, sep } from "node:path";

/**
 * Serves the repo-root `papers/` data directory at `/papers/*` during `vite dev`,
 * so the skill's output is readable without a copy step while developing.
 * Production builds instead get a real copy under public/papers/ (see
 * scripts/sync-papers-data.mjs), because GH Pages only serves files in dist/.
 */
function servePapersData(): Plugin {
  const papersRoot = join(process.cwd(), "papers");
  const mime: Record<string, string> = {
    ".json": "application/json",
    ".pdf": "application/pdf",
    ".png": "image/png",
  };
  return {
    name: "serve-papers-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/papers/")) return next();
        const relative = decodeURIComponent(req.url.slice("/papers/".length).split("?")[0]);
        const filePath = normalize(join(papersRoot, relative));
        if (
          !filePath.startsWith(papersRoot + sep) ||
          !existsSync(filePath) ||
          !statSync(filePath).isFile()
        ) {
          return next();
        }
        const ext = filePath.slice(filePath.lastIndexOf("."));
        if (mime[ext]) res.setHeader("Content-Type", mime[ext]);
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

// GitHub Pages serves this repo at https://theghoul21.github.io/paper-reader/, so production
// builds (and `vite preview` of them) use that base path; `vite dev` stays at the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/paper-reader/" : "/",
  plugins: [react(), servePapersData()],
}));
