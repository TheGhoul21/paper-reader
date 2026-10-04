# Formati e sviluppo di Paper Reader

## Project

A static React app for guided reading: a paper opens with orientation, continues through authored steps and ends with reflection, evidence and doubts to revisit. The PDF reader remains available for source comparison and annotations; clicking a paragraph shows its anchored explanation. Papers are imported with the `import-paper` skill, which extracts text and positions and guides the editorial work. The app is deployable to GitHub Pages.

The project previously worked very differently (a Quarto site of hand-restructured explainer documents). That is a separate repo, `TheGhoul21/phase-kickback` (its own GitHub Pages site) — this repo started from a fresh history and doesn't include it. A local `legacy/` folder may exist as a gitignored copy; for its source PDFs/`.tex` (re-import material), prefer a fresh clone of phase-kickback, which is more up to date.

## Commands

- `npm run dev` — local dev server (serves `papers/` live, no copy step)
- `npm test` — reader, loading, storage, search, rendering and library-data regressions
- `npm run test:import` — offline source-version, passage-merging and thumbnail tests (uv)
- `npm run thumbnails -- <slug>` — generate a cached 640 px cover image after importing a PDF; omit the slug to process the library
- `npm run concepts-index` — regenerate `papers/concepts-index.json` after adding/editing any `concepts.json`
- `npm run build` — production build to `dist/` (copies `papers/` → `public/papers/` first, via `scripts/sync-papers-data.mjs`; adds `404.html` as SPA fallback after)
- Deploy: push to `main` — `.github/workflows/deploy.yml` builds and publishes to GitHub Pages at https://theghoul21.github.io/paper-reader/. Production builds use the `/paper-reader/` base path (`vite.config.ts`), so URLs to `papers/` go through `lib/paths.ts`'s `papersUrl()`, never a hard-coded `/papers/...`.
- Import a paper: follow the manual workflow below; agents may use the import-paper skill
- Paper requests: readers open GitHub issues with the `paper-request` form (the reader's citation popover and header link prefill it — `lib/requests.ts`). Protocol in `docs/paper-requests.md`; work them with the skill's "Importing from a GitHub issue" section (`find_paper.py` finds the paper, checks duplicates and licence). Only papers whose licence allows redistribution (CC BY/BY-SA/CC0) may be imported — the PDF is published verbatim.

## Structure

- `papers/` — the data the reader reads, one folder per paper:
  - `index.json` — library manifest (title, authors, language, background, tldr per paper)
  - `<slug>/meta.json` — full metadata for one paper, plus `tldr`: the paper in brief, `{problem, idea, result, why?}` keyed by language (not variant) — always plain language, whatever the variants' levels. Shown as the "In breve" strip under the reader's toolbar — the idea in one line, a drop-down panel with all fields on click (`components/TldrStrip.tsx`) — and as problem + idea on the library card; mirrored in `index.json`.
  - `<slug>/source/paper.pdf` — the original PDF, verbatim
  - `<slug>/source/thumbnail.png` — prebuilt first-page image; `thumbnail.sha256` records its source PDF hash. Library cards load this image and do not parse PDFs.
  - `<slug>/concepts.json` — optional glossary: `{id, term, aliases, pdfTerms?, kind, definedIn, definitions, related}` per concept. `definitions` is keyed by variant like `explanations`; `definedIn` is a paragraph id. `term`/`aliases` are matched against explanation text (`lib/concepts.ts`); `pdfTerms` against the PDF's own text, for highlighting (`lib/conceptHighlight.ts`). `id` is shared across papers for the same concept.
  - `<slug>/structure.json` — optional argument map: `{thesis, claims: [{id, title, summary, statedIn, evidence, dependsOn}]}` (texts keyed by variant, `statedIn`/`evidence` are paragraph ids, `dependsOn` claim ids). Drives the notes pane's "Mappa" tab, the role chips on notes and the toolbar's "Il filo". Optional `readingGuide` adds section context and the "Guida" tab; see "Reading guides" below. Fine to hand-edit; validate with the skill's `check_paper.py`.
  - `concepts-index.json` — generated (`npm run concepts-index`, also run by the build): concept id → every paper that defines it, for the reader's cross-paper links. Don't hand-edit.
  - `<slug>/paragraphs.json` — ordered paragraph records: `{id, page, order, section?, rects, sourceText, explanations, notebookSuggestion?, recall?, deepDive?}`. `rects` are fractions of page width/height (0–1), top-left origin — see `.claude/skills/import-paper/scripts/extract_blocks.py`'s docstring for why no coordinate flip is needed against the pdf.js canvas. `explanations` is keyed by variant (`"<language>-<level>"`, e.g. `"it-beginner"`) — a paragraph may have one or several. `leadsTo` (optional) is `[{to, why}]` for set-up paragraphs whose point only shows later: `to` a later paragraph id, `why` (keyed by variant) what this paragraph contributes there — shown as "Servirà più avanti" under the note, hover previews the target. `deepDive` (optional, keyed by variant) is a long-form markdown + KaTeX explanation for dense paragraphs, shown collapsed under the note (`components/DeepDive.tsx`, lazy-loaded; rendering in `lib/deepDive.ts`); `[par. N](#<id>)` links jump to another paragraph.
- `src/` — the reader app (React + Vite + pdf.js):
  - `pages/Library.tsx` (choice by problem/idea, latest guided session to resume and review banner), `pages/Review.tsx` (the `/review` spaced-repetition session: one card at a time, recall prompt → answer → grade; keys space and 1–4), `pages/Reader.tsx` (validated data, selected variant and guided/PDF mode).
  - `pages/GuidedReading.tsx` composes `components/guided/`: `ReadingOverview`, `ReadingStep`, `ReadingSummary`, content, navigation and glossary. `lib/guidedReading.ts` defines progress and pure atomic transitions; `lib/useGuidedReading.ts` owns URL, recoverable persistence, focus and scroll. The temporary UI variants and switcher were removed after A was selected.
  - `components/PdfViewer.tsx` (composition of the reader and lazy page list; session, document, viewport and asynchronous searches are in named lib modules) + `Toolbar.tsx` (the dark full-width chrome above the pages — zoom, page nav, fit, search, annotation tools, variant selector, download) + `icons.tsx` (its inline SVG icons)
  - `components/PageCanvas.tsx` (renders one page: canvas + `TextLayer.tsx` for real/searchable PDF text + `ParagraphOverlay.tsx` for click-to-explain hit areas and numbered paragraph badges + `AnnotationLayer.tsx` for notes/drawing)
  - `components/NotesPane.tsx` (the comments column: every explanation as an `ExplanationNote.tsx`, grouped by page, scrolling independently of the PDF pane; concept mentions in each note are clickable and open `ConceptPopover.tsx` — definition, related concepts, same concept in other papers, jump to where it's introduced, "Evidenzia nel PDF" which marks occurrences with `ConceptHighlightBar.tsx` to step through them) + `NoteConnector.tsx` (the line from the active/hovered comment to its paragraph, drawn over both panes)
  - `components/Popover.tsx` (the floating-card shell shared by `CitationPopover.tsx` and `ConceptPopover.tsx`)
  - `lib/concepts.ts` (glossary matching: builds one regex from all concept spellings, splits explanation text into plain runs + first mention of each concept) and `lib/conceptHighlight.ts` (counts a concept's occurrences in the PDF and marks them in the pdf.js text layers, matching each page's text as one string since pdf.js splits math/symbols into separate items)
  - `pages/Reader.tsx` accepts `?p=<paragraphId>` to open a paper at a paragraph (used by cross-paper glossary links)
  - `lib/papers.ts` — shared, validated paper loading for Reader and Review: successful results are cached, concurrent requests are shared, and cancellation is per consumer. Reader data and PDF state are keyed by slug so late responses cannot replace the current paper.
  - `components/ArgumentMap.tsx` + `lib/structure.ts` (the argument map: claim labels C1…Cn, each paragraph's role, "il filo" = every paragraph that states or supports a claim; marks those passages in yellow in the PDF and filters comments, keeping all PDF text readable)
  - `components/ReadingGuide.tsx` + `lib/readingGuide.ts` (section goals and steps; selected notes offer expandable "In concreto" and "Perché questo passaggio" context, with an optional diagram from `public/`). The guides cover all imported paragraph records in their existing variants. This does not establish coverage of the entire original PDF: see the [guided-reading proposal](guided-reading-experience-2026-10-04.md) for the DAScut content gap. The guide follows the selected paragraph; its section selector lets the reader explore the rest of the paper. `npm run test:reading-guide` checks assignment of the imported records across the library and paragraph context.
  - `lib/review.ts` (review deck: cards added from a note's "Da ripassare" or the glossary popover's "Aggiungi al ripasso", simplified SM-2 scheduling, `useReview`/`useDueCount` hooks synced across components and tabs)
  - `lib/search.ts` + `lib/pdfText.ts` — cached page text, search across PDF items, all occurrences, ligature/whitespace normalization with exact source offsets. Matches are highlighted with separate range overlays. Offscreen `PageCanvas` instances retain their dimensions but release canvases and text layers while preserving annotation editors; canvas backing stores are capped at 16M pixels.
  - `lib/userData.ts` + `lib/storage.ts` — one observable store for review and annotations, validated migration, atomic persistence and recoverable save errors. `StorageStatus.tsx` offers retry and an export of unsaved work.
- `.claude/skills/import-paper/` — the import skill: `SKILL.md` plus `scripts/resolve_source.py` (fetch/copy the PDF + basic metadata) and `scripts/extract_blocks.py` (PDF → ordered, positioned text blocks via PyMuPDF, run through `uv run`).

## Data model rules

- `rects`, `page`, and `order` in `paragraphs.json` come from PDF extraction — don't estimate positions. Repair wrong extraction from the original PDF and check its reading order. New logical passages may include `anchors: [{page, rects}, ...]` across pages; `page` and `rects` mirror the first anchor for compatibility. Never append a next-page rectangle to the current page's `rects`. `lib/paragraphs.ts` projects each passage into its page hit areas while preserving its single ID and explanation. Use the import skill's `merge_passages.py` on reviewed intermediate blocks, before publishing IDs. Preserve all published IDs when repairing data; a split can add a new descriptive ID, with guide/glossary/claim/link references reviewed together. `explanations`, `section`, `notebookSuggestion`, `leadsTo`, `deepDive` (validate with the skill's `scripts/check_deep_dives.mjs <slug>`) and `recall` are fine to hand-edit; don't renumber existing recall IDs, review cards reference them.
- Explanations must explain a complete idea even when the source block is an equation fragment or continuation: name the object, recover its context from the PDF, state the mechanism and relevant conditions. Ellipses and literal translations do not substitute for an explanation. Never invent missing text or infer two-column order solely from adjacent JSON entries.
- `meta.json` records `sourceSha256` for the exact stored PDF and, for new arXiv imports, `sourceVersion` plus a versioned `sourceRef`. Preserve a requested `vN`; unversioned inputs must resolve to a revision before download. For existing imports, record the stored PDF hash without guessing an unknown historical revision. A changed PDF requires a reviewed reimport, not just new thumbnails.
- `concepts.json`'s `definedIn`/`related` must reference existing paragraph/concept ids, and each concept's `definitions` should cover the same variant keys as `meta.json`'s `variants` (all declared variants are required; fallback only handles a retired saved selection). Fine to hand-edit; the skill's step 4b / "Adding a glossary" workflow writes it. After any edit, run the skill's `scripts/check_concepts.mjs <slug>` and `npm run concepts-index`.
- `meta.json`'s `variants` array must list exactly the keys actually present across `paragraphs.json`'s `explanations` objects (all declared variants are required; a retired saved selection falls back visibly). When adding a variant, review the entire paper and extend every relevant editorial field; agents can follow the skill's Adding a variant workflow.
- `papers/index.json` must stay in sync with the set of `papers/<slug>/` folders — the skill maintains it, but if you add/remove a paper folder by hand, update it too.
- Annotations and the review deck live only in browser `localStorage`, in the version-2 `paper-reader:user-data` envelope. Legacy `paper-reader:annotations:<slug>` and `paper-reader:review` keys are read on first use and left intact as recovery copies; the next successful write commits all data in one operation. Hooks share one store and receive cross-tab storage changes. Save failures keep new work in memory and show a persistent export/retry banner; unreadable existing data is never overwritten. Backup files remain version 1 for compatibility, validate entirely before import, and merge conflicts by `updatedAt` (not `reps`, which resets after a failed recall). Legacy backup records without a modification timestamp add missing records but do not replace existing ones. Card IDs are `<slug>:<concept|paragraph|question>:<refId>`; published paragraph, concept and recall IDs must remain stable.

## Reading guides

`structure.json` includes `readingGuide`, an array of `{id, title, goal, steps, leadsTo?}`. Each step is `{id, title, paragraphs, meaning, purpose, diagram?}`; all text fields use the paper's existing variant keys. A complete-paper guide should include the scientific content and relevant appendices, but the automatic coverage check only establishes that all imported paragraph records are assigned. Compare the actual PDF by section before describing a guide as complete. `paragraphs` contains explicit paragraph ids in reading order, including captions, footnotes and continuations belonging to the passage. Every paragraph belongs to exactly one step. Group administrative passages by their actual role. `leadsTo` is `{paragraphId, why}` and points to a later passage. The reader remains compatible with older data without guides.

Write `meaning` to ground the actual objects in 2–3 sentences (e.g. a layout describes physical qubits and their connectivity; a chain describes a sequence of gates), and `purpose` to explain what the passage contributes toward `goal`. Read the section and its later uses first. Keep the section route short; group paragraphs that serve the same purpose. This complements the claim map, which lists what the paper establishes rather than the steps needed to understand a section. An optional `diagram` is `{path, caption}`: `path` is relative to `public/`, and captions are keyed by variant. Use `BASE_URL` when rendering it so GitHub Pages works.

Validate imports with `python3 .claude/skills/import-paper/scripts/check_paper.py <slug> --require-reading-guide`: coverage, guide ids, variants, paragraph ordering and uniqueness, images and forward references are checked. The selected note offers its step's context in "Contesto e percorso della sezione"; "Il percorso della sezione" opens the "Guida" tab at that section. Following a paragraph link reveals that note, clearing "Il filo" if it excluded the target.

## Manutenzione del lettore

`/paper/<slug>` apre l'orientamento; `?stage=read&step=<stepId>&v=<variant>` apre una tappa e `?stage=summary` la sintesi. `?view=pdf` apre la fonte; i link storici con `?p=<paragraphId>` restano PDF. `?view=guide&p=<paragraphId>` raggiunge un passaggio nella guida, espandendo gli altri passaggi della tappa quando necessario. Il confronto dalla guida porta `from=guide`, `step` e `stage` nel link PDF; il ritorno conserva tappa, variante e scroll.

Il campo opzionale `journeys` dello store versione 2 e del backup versione 1 contiene per slug `{phase, stepId, variant, explored, doubts, reflection, scrollY, updatedAt}`. `phase` è `reading` o `summary`; l'orientamento non cancella la posizione precedente. Avanzamento e dubbio vengono salvati con una sola transizione. `explored` e `doubts` usano ID unici; i dubbi sono un sottoinsieme delle tappe esplorate. I riferimenti non più disponibili si conservano nello storage, ma il conteggio e la navigazione usano solo quelli validi e segnalano l'aggiornamento.

I vecchi backup senza `journeys` restano importabili e non cancellano un percorso esistente. I conflitti scelgono il record con `updatedAt` più recente. Se lo storage precedente è illeggibile, la guida mantiene il nuovo lavoro in memoria e offre un backup parziale del solo nuovo percorso; non sovrascrive i dati precedenti. Se una scrittura fallisce, lo store recuperabile e la sua esportazione contengono il lavoro non salvato.

La sessione in `readerSession.ts` possiede le transizioni di selezione/scheda/filtro. `PdfViewer` compone le superfici. `usePdfDocument` carica e permette retry; `usePdfViewport` misura il contenitore con ResizeObserver e adatta la pagina; ricerca e glossario cancellano le richieste obsolete. `pdfNavigation` raccoglie convenzioni DOM e attese cancellabili del rendering.

Le note personali sono salvate mentre si scrive tramite lo store condiviso; AnnotationLayer resta montato durante il redraw e fuori dalla finestra dei canvas. Annulla modifica ripristina il testo precedente. Eliminazioni e voti hanno un recupero per l'ultima operazione. Il backup versione 1 include opzionalmente posizione e preferenze; i vecchi backup restano importabili. La struttura localStorage versione 2 accetta gli stessi campi opzionali.

Le schede del pannello usano navigazione con frecce e collegamenti ARIA. I popover sono dialog non modali: focus iniziale, Escape, ritorno al controllo di apertura, scroll interno consentito. I colori sopra l'accento sono definiti con `--on-accent`; gli stili delle schermate sono separati in `src/styles/`.

## Importazione manuale senza LLM

Gli script estraggono dati del PDF; non scrivono automaticamente le spiegazioni. La parte editoriale richiede leggere e comprendere il paper. Verificare la licenza di redistribuzione prima di aggiungere il PDF pubblicato.

```sh
uv run .claude/skills/import-paper/scripts/resolve_source.py /percorso/paper.pdf --slug esempio
uv run .claude/skills/import-paper/scripts/extract_blocks.py papers/esempio/source/paper.pdf --out /tmp/blocks-esempio.json
```

1. Correggere titolo/autori dai dati reali, leggere i blocchi e confrontare ordine e continuazioni con il PDF. Usare `--all` per diagnosticare classificazione di titoli, figure o note.
2. Curare i passaggi prima di pubblicare gli ID. Il merge script permette ancore su più pagine; consultare `--help` prima di applicarlo. Copiare le coordinate estratte, senza inventarle.
3. Scrivere `paragraphs.json` con spiegazioni per tutte le varianti e `meta.json` con fonte/versione/hash e metadati. Seguire i tipi in `src/types.ts` e un paper corrente come esempio.
4. Scrivere glossario, domande, mappa e guida con riferimenti agli ID esistenti. Una guida assegna ogni passaggio a uno step. Approfondimenti e diagrammi sono opzionali.
5. Aggiungere la voce coerente in `papers/index.json`, rigenerare indice e copertina, poi verificare.

```sh
npm run concepts-index
npm run thumbnails -- esempio
npm run validate:papers
npm test
npm run build
```

Per correggere un paper pubblicato, lavorare sui JSON curati senza riavviare l'estrazione o rinumerare gli ID. Un PDF cambiato richiede una revisione dell'importazione e delle ancore.
