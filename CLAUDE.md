# CLAUDE.md — Paper Reader

## Project

A PDF reader: it shows the original paper PDF, and clicking a paragraph shows a layman-terms explanation anchored to that paragraph. Papers are imported with the `import-paper` skill, which extracts paragraph text + on-page position from the PDF and writes an explanation for each one. The reader is a small static React app, deployable to GitHub Pages.

The project previously worked very differently (a Quarto site of hand-restructured explainer documents). That is a separate repo, `TheGhoul21/phase-kickback` (its own GitHub Pages site) — this repo started from a fresh history and doesn't include it. A local `legacy/` folder may exist as a gitignored copy; for its source PDFs/`.tex` (re-import material), prefer a fresh clone of phase-kickback, which is more up to date.

## Commands

- `npm run dev` — local dev server (serves `papers/` live, no copy step)
- `npm run build` — production build to `dist/` (copies `papers/` → `public/papers/` first, via `scripts/sync-papers-data.mjs`; adds `404.html` as SPA fallback after)
- Deploy: push to `main` — `.github/workflows/deploy.yml` builds and publishes to GitHub Pages at https://theghoul21.github.io/paper-reader/. Production builds use the `/paper-reader/` base path (`vite.config.ts`), so URLs to `papers/` go through `lib/paths.ts`'s `papersUrl()`, never a hard-coded `/papers/...`.
- Import a paper: invoke the `import-paper` skill with a link (arXiv, direct PDF URL) or a local PDF path

## Structure

- `papers/` — the data the reader reads, one folder per paper:
  - `index.json` — library manifest (title, authors, language, background per paper)
  - `<slug>/meta.json` — full metadata for one paper
  - `<slug>/source/paper.pdf` — the original PDF, verbatim
  - `<slug>/paragraphs.json` — ordered paragraph records: `{id, page, order, section?, rects, sourceText, explanations, notebookSuggestion?}`. `rects` are fractions of page width/height (0–1), top-left origin — see `.claude/skills/import-paper/scripts/extract_blocks.py`'s docstring for why no coordinate flip is needed against the pdf.js canvas. `explanations` is keyed by variant (`"<language>-<level>"`, e.g. `"it-beginner"`) — a paragraph may have one or several.
- `src/` — the reader app (React + Vite + pdf.js):
  - `pages/Library.tsx` (paper list), `pages/Reader.tsx` (one paper — owns the selected explanation variant and the annotations for that paper, via `lib/annotations.ts`)
  - `components/PdfViewer.tsx` (zoom/fit/page-nav/search state, lazy page list) + `Toolbar.tsx` (the dark full-width chrome above the pages — zoom, page nav, fit, search, annotation tools, variant selector, download) + `icons.tsx` (its inline SVG icons)
  - `components/PageCanvas.tsx` (renders one page: canvas + `TextLayer.tsx` for real/searchable PDF text + `ParagraphOverlay.tsx` for click-to-explain hit areas and numbered paragraph badges + `AnnotationLayer.tsx` for notes/drawing)
  - `components/NotesPane.tsx` (the comments column: every explanation as an `ExplanationNote.tsx`, grouped by page, scrolling independently of the PDF pane) + `NoteConnector.tsx` (the line from the active/hovered comment to its paragraph, drawn over both panes)
  - `lib/search.ts` (full-document text search over `page.getTextContent()`, independent of which pages have lazily rendered) and `lib/annotations.ts` (the `localStorage`-backed annotations hook)
- `.claude/skills/import-paper/` — the import skill: `SKILL.md` plus `scripts/resolve_source.py` (fetch/copy the PDF + basic metadata) and `scripts/extract_blocks.py` (PDF → ordered, positioned text blocks via PyMuPDF, run through `uv run`).

## Data model rules

- `rects`, `page`, and `order` in `paragraphs.json` come only from `extract_blocks.py`'s output — don't hand-edit them; regenerate via the skill if extraction was wrong. `explanations`, `section`, and `notebookSuggestion` are fine to hand-edit.
- `meta.json`'s `variants` array must list exactly the keys actually present across `paragraphs.json`'s `explanations` objects (a paragraph missing a key falls back to that paper's first variant in the reader, with a visible note — see `ExplanationNote.tsx`). Use the skill's "Adding a variant" workflow rather than hand-writing new `explanations` entries — it batches the writing with whole-paper context, which one-off hand edits won't have.
- `papers/index.json` must stay in sync with the set of `papers/<slug>/` folders — the skill maintains it, but if you add/remove a paper folder by hand, update it too.
- Annotations (`Toolbar`'s Nota/Disegna tools) live only in the viewer's `localStorage` (`paper-reader:annotations:<slug>`) — they are per-browser/device, not part of `papers/` and not committed with the rest of the paper's data.

## Do NOT

- Add Co-Authored-By lines to commits
- Create `.ipynb` files (notebooks are explicitly out of scope for this version — see `import-paper`'s SKILL.md)
- Build/serve or commit `legacy/` — it's a local reference copy of the phase-kickback repo only
