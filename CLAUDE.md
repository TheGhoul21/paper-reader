# CLAUDE.md — Paper Reader

## Project

A PDF reader: it shows the original paper PDF, and clicking a paragraph shows a layman-terms explanation anchored to that paragraph. Papers are imported with the `import-paper` skill, which extracts paragraph text + on-page position from the PDF and writes an explanation for each one. The reader is a small static React app, deployable to GitHub Pages.

The project previously worked very differently (a Quarto site of hand-restructured explainer documents). That is a separate repo, `TheGhoul21/phase-kickback` (its own GitHub Pages site) — this repo started from a fresh history and doesn't include it. A local `legacy/` folder may exist as a gitignored copy; for its source PDFs/`.tex` (re-import material), prefer a fresh clone of phase-kickback, which is more up to date.

## Commands

- `npm run dev` — local dev server (serves `papers/` live, no copy step)
- `npm run concepts-index` — regenerate `papers/concepts-index.json` after adding/editing any `concepts.json`
- `npm run build` — production build to `dist/` (copies `papers/` → `public/papers/` first, via `scripts/sync-papers-data.mjs`; adds `404.html` as SPA fallback after)
- Deploy: push to `main` — `.github/workflows/deploy.yml` builds and publishes to GitHub Pages at https://theghoul21.github.io/paper-reader/. Production builds use the `/paper-reader/` base path (`vite.config.ts`), so URLs to `papers/` go through `lib/paths.ts`'s `papersUrl()`, never a hard-coded `/papers/...`.
- Import a paper: invoke the `import-paper` skill with a link (arXiv, direct PDF URL) or a local PDF path
- Paper requests: readers open GitHub issues with the `paper-request` form (the reader's citation popover and header link prefill it — `lib/requests.ts`). Protocol in `docs/paper-requests.md`; work them with the skill's "Importing from a GitHub issue" section (`find_paper.py` finds the paper, checks duplicates and licence). Only papers whose licence allows redistribution (CC BY/BY-SA/CC0) may be imported — the PDF is published verbatim.

## Structure

- `papers/` — the data the reader reads, one folder per paper:
  - `index.json` — library manifest (title, authors, language, background per paper)
  - `<slug>/meta.json` — full metadata for one paper
  - `<slug>/source/paper.pdf` — the original PDF, verbatim
  - `<slug>/concepts.json` — optional glossary: `{id, term, aliases, pdfTerms?, kind, definedIn, definitions, related}` per concept. `definitions` is keyed by variant like `explanations`; `definedIn` is a paragraph id. `term`/`aliases` are matched against explanation text (`lib/concepts.ts`); `pdfTerms` against the PDF's own text, for highlighting (`lib/conceptHighlight.ts`). `id` is shared across papers for the same concept.
  - `<slug>/structure.json` — optional argument map: `{thesis, claims: [{id, title, summary, statedIn, evidence, dependsOn}]}` (texts keyed by variant, `statedIn`/`evidence` are paragraph ids, `dependsOn` claim ids). Drives the notes pane's "Mappa" tab, the role chips on notes and the toolbar's "Il filo". Fine to hand-edit; validate with the skill's `check_paper.py`.
  - `concepts-index.json` — generated (`npm run concepts-index`, also run by the build): concept id → every paper that defines it, for the reader's cross-paper links. Don't hand-edit.
  - `<slug>/paragraphs.json` — ordered paragraph records: `{id, page, order, section?, rects, sourceText, explanations, notebookSuggestion?, recall?}`. `rects` are fractions of page width/height (0–1), top-left origin — see `.claude/skills/import-paper/scripts/extract_blocks.py`'s docstring for why no coordinate flip is needed against the pdf.js canvas. `explanations` is keyed by variant (`"<language>-<level>"`, e.g. `"it-beginner"`) — a paragraph may have one or several.
- `src/` — the reader app (React + Vite + pdf.js):
  - `pages/Library.tsx` (paper list, plus a "N da ripassare oggi" banner), `pages/Review.tsx` (the `/review` spaced-repetition session: one card at a time, recall prompt → answer → grade; keys space and 1–4), `pages/Reader.tsx` (one paper — owns the selected explanation variant and the annotations for that paper, via `lib/annotations.ts`)
  - `components/PdfViewer.tsx` (zoom/fit/page-nav/search state, lazy page list) + `Toolbar.tsx` (the dark full-width chrome above the pages — zoom, page nav, fit, search, annotation tools, variant selector, download) + `icons.tsx` (its inline SVG icons)
  - `components/PageCanvas.tsx` (renders one page: canvas + `TextLayer.tsx` for real/searchable PDF text + `ParagraphOverlay.tsx` for click-to-explain hit areas and numbered paragraph badges + `AnnotationLayer.tsx` for notes/drawing)
  - `components/NotesPane.tsx` (the comments column: every explanation as an `ExplanationNote.tsx`, grouped by page, scrolling independently of the PDF pane; concept mentions in each note are clickable and open `ConceptPopover.tsx` — definition, related concepts, same concept in other papers, jump to where it's introduced, "Evidenzia nel PDF" which marks occurrences with `ConceptHighlightBar.tsx` to step through them) + `NoteConnector.tsx` (the line from the active/hovered comment to its paragraph, drawn over both panes)
  - `components/Popover.tsx` (the floating-card shell shared by `CitationPopover.tsx` and `ConceptPopover.tsx`)
  - `lib/concepts.ts` (glossary matching: builds one regex from all concept spellings, splits explanation text into plain runs + first mention of each concept) and `lib/conceptHighlight.ts` (counts a concept's occurrences in the PDF and marks them in the pdf.js text layers, matching each page's text as one string since pdf.js splits math/symbols into separate items)
  - `pages/Reader.tsx` accepts `?p=<paragraphId>` to open a paper at a paragraph (used by cross-paper glossary links)
  - `components/ArgumentMap.tsx` + `lib/structure.ts` (the argument map: claim labels C1…Cn, each paragraph's role, "il filo" = every paragraph that states or supports a claim)
  - `lib/review.ts` (review deck: cards added from a note's "Da ripassare" or the glossary popover's "Aggiungi al ripasso", simplified SM-2 scheduling, `useReview`/`useDueCount` hooks synced across components and tabs)
  - `lib/search.ts` (full-document text search over `page.getTextContent()`, independent of which pages have lazily rendered) and `lib/annotations.ts` (the `localStorage`-backed annotations hook)
- `.claude/skills/import-paper/` — the import skill: `SKILL.md` plus `scripts/resolve_source.py` (fetch/copy the PDF + basic metadata) and `scripts/extract_blocks.py` (PDF → ordered, positioned text blocks via PyMuPDF, run through `uv run`).

## Data model rules

- `rects`, `page`, and `order` in `paragraphs.json` come only from `extract_blocks.py`'s output — don't hand-edit them; regenerate via the skill if extraction was wrong. `explanations`, `section`, `notebookSuggestion` and `recall` (optional recall questions `{id, q, a}`, `q`/`a` keyed by variant, reviewed in `/review`) are fine to hand-edit; don't renumber existing `recall` ids, review cards reference them.
- `concepts.json`'s `definedIn`/`related` must reference existing paragraph/concept ids, and each concept's `definitions` should cover the same variant keys as `meta.json`'s `variants` (a missing key falls back to the first definition, with the same visible note as explanations). Fine to hand-edit; the skill's step 4b / "Adding a glossary" workflow writes it. After any edit, run the skill's `scripts/check_concepts.mjs <slug>` and `npm run concepts-index`.
- `meta.json`'s `variants` array must list exactly the keys actually present across `paragraphs.json`'s `explanations` objects (a paragraph missing a key falls back to that paper's first variant in the reader, with a visible note — see `ExplanationNote.tsx`). Use the skill's "Adding a variant" workflow rather than hand-writing new `explanations` entries — it batches the writing with whole-paper context, which one-off hand edits won't have.
- `papers/index.json` must stay in sync with the set of `papers/<slug>/` folders — the skill maintains it, but if you add/remove a paper folder by hand, update it too.
- Annotations (`Toolbar`'s Nota/Disegna tools) live only in the viewer's `localStorage` (`paper-reader:annotations:<slug>`) — they are per-browser/device, not part of `papers/` and not committed with the rest of the paper's data. Same for the review deck (`paper-reader:review`, library-wide; card ids are `<slug>:<concept|paragraph>:<refId>`, so renaming a concept id or re-importing a paper orphans its cards — the review page offers to remove those).

## Do NOT

- Add Co-Authored-By lines to commits
- Create `.ipynb` files (notebooks are explicitly out of scope for this version — see `import-paper`'s SKILL.md)
- Build/serve or commit `legacy/` — it's a local reference copy of the phase-kickback repo only
