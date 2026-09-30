---
name: import-paper
description: Import an academic paper (arXiv link/ID, direct PDF URL, or local PDF path) into the paper-reader library — extracts the PDF's paragraphs with their on-page positions and writes a layman-terms explanation for each one, so the reader app can show the original PDF with click-to-explain paragraphs. Also handles adding an extra background-level/language variant to an already-imported paper. Use when the user asks to import/add a paper, gives a paper link/PDF and asks for it to be explained, or asks to add another explanation level/language to a paper already in the library.
---

# import-paper

Turns a paper into `papers/<slug>/{meta.json, paragraphs.json, source/paper.pdf}` — the data the reader web app (`src/`) reads. See `CLAUDE.md` for the data model.

Each paragraph can carry **multiple explanation variants** — one per (language, background level) combination — selectable in the reader. Canonical level keys: `beginner` (no background in the field), `intermediate` (adjacent-field grad level), `expert` (expert in this exact subfield). A variant key is `"<language>-<level>"`, e.g. `"it-beginner"`.

If the target slug already exists in `papers/`, skip straight to **"Adding a variant to an already-imported paper"** below instead of running the full import.

## 1. Get the interview answers, fast

You need, for each variant to generate: **background level(s)** and **target language(s)**.

- First, check whether the user's own invocation already answers these (e.g. "importa questo paper in italiano per un principiante" answers both, one variant). Don't ask what's already answered.
- For whatever is still missing, ask in **one** `AskUserQuestion` call with all the missing fields as separate questions (allow multi-select on both) — never ask them one at a time.
  - Background: "no background in this field" / "adjacent-field grad level" / "expert in this exact subfield" — multiple selectable.
  - Language: default to the language the user is writing to you in; only ask if genuinely ambiguous (e.g. a bare URL with no surrounding text).
- **Default to generating exactly one variant** (one language × one level) unless the user clearly asks for more. Each additional variant costs roughly another full pass of writing explanations for every paragraph (see step 4) — say so explicitly if the user's request would produce more than one, so they can confirm the cost before you commit to it. It's always cheap to add another variant later (see below), so when unsure, generate one now and offer the rest as a follow-up.
- If the user says something like "just decide" / "pick something sensible", stop asking and default to a single variant: background = "no background in this field", language = the language of this conversation.

## 2. Resolve the source

```
uv run .claude/skills/import-paper/scripts/resolve_source.py <input> [--slug SLUG]
```

`<input>` can be an arXiv id/URL, a direct PDF URL, or a local file path. This downloads/copies the PDF to `papers/<slug>/source/paper.pdf` and prints a JSON skeleton (`slug`, `title`, `authors`, `sourceType`, `sourceRef`, `pdfPath`) to stdout — it does not write `meta.json`.

For `local` and generic `url` sources, `resolve_source.py` cannot fetch real metadata (title/authors come from the filename). Correct `title`/`authors` from the actual first page before writing `meta.json` — `extract_blocks.py --all` shows the page-1 blocks classified as `title`/`authors`, which the default output leaves out.

## 3. Extract blocks

```
uv run .claude/skills/import-paper/scripts/extract_blocks.py papers/<slug>/source/paper.pdf --out /tmp/blocks-<slug>.json
```

Produces an ordered array of `{id, page, order, kind, section?, rects, text}` — one entry per paragraph worth a comment, in reading order, with page-relative fractional bounding boxes (see the script's docstring for the coordinate convention — no flipping needed, it already matches the reader's canvas).

The script classifies every text block (font size/weight, position, text patterns — full list in its docstring) and **only emits `body` paragraphs and `caption`s**. Everything else is left out on purpose and must not get a comment: title, author names, affiliations, emails, dates/DOIs/arXiv stamps/copyright/keywords (all the page-1 front matter above the abstract), section headings, labels inside figures, page numbers, and the bibliography. Headings aren't lost: each emitted block carries the nearest preceding heading as `section`. Display equations are merged into the paragraph before them (extra rect), so they're explained in context. If something looks wrongly dropped or kept, rerun with `--all` to see every block with its `kind`.

**Read the output and sanity-check it** before moving on:
- Reading order should track the actual paper. The two-column heuristic is approximate — miss-ordered runs are the most likely defect. Note that a running page number sitting near the horizontal center of the page (x fraction ~0.48–0.52) silently defeats the two-column detection for that whole page (it lands in neither the "left" nor "right" bucket) — check for this specifically and re-sequence by hand when it happens, since the fallback is a plain top-to-bottom sort that interleaves both columns.
- Drop anything that still isn't real paper prose: leftover front matter/affiliations, figure-internal text the figure detection missed (axis labels, circuit/table cells, algorithm pseudo-code lines), stray footnote markers. Running headers/footers are stripped when they repeat on ≥3 pages ignoring page numbers.
- Merge a paragraph that the PDF splits across a column or page break (append the second block's rects and text to the first), and sub-figure captions ("(a) …", "(b) …") into their figure's main caption.
- You may merge, split, reorder, or delete entries in this intermediate array freely — it's scratch data, not the final output.

## 4. Write the explanations

For each surviving block, write one explanation per requested variant, at that variant's language and background level, into an `explanations` object keyed by variant (keep the original text too, renamed `sourceText`).

- Read the full block text list once up front for whole-paper context (what the paper is actually arguing), then write explanations in batches of roughly 15–20 blocks × all variants for that batch, so each batch stays coherent with the paper's argument without one tool call per paragraph.
- Don't add back what extraction deliberately left out (authors, affiliations, metadata, headings, references) — nobody needs a comment explaining a list of names. Acknowledgments, funding and data-availability paragraphs get a one-line explanation at most, or can be dropped.
- Explanation depth should actually track the requested level — an `expert` variant should read differently from a `beginner` one for the same paragraph (denser, assumes vocabulary, focuses on what's novel), not just be a shorter/longer version of the same text.
- **Keep explanations attached to their block id, never to a position in a list.** Two ways this silently went wrong before: writing an explanation for a section heading (headings are not blocks — see step 3), and explaining text the extraction lost (it exists in the paper but in no block). Both push every following explanation one paragraph out of place. If the paper has text that no block contains, fold its explanation into the block just before it; never insert an extra entry.
- After writing, run `python3 .claude/skills/import-paper/scripts/check_paper.py <slug>`; it must print `OK` (it flags runs of 3+ paragraphs whose explanation matches a neighbour's text better than their own).
- If a passage clearly wants an interactive notebook (a formula worth playing with, an algorithm worth stepping through), set `notebookSuggestion` on that block instead of building anything — notebooks are out of scope for this skill.

**Optional: draft explanations with a local model first.** If the user is cost-conscious and has Ollama running locally, `scripts/generate_explanations_local.mjs` can draft a whole variant's explanations against `qwen3.5:4b` (thinking disabled) before you touch it by hand:

```
ollama pull qwen3.5:4b   # once
node .claude/skills/import-paper/scripts/generate_explanations_local.mjs \
  papers/<slug>/paragraphs.json \
  --variant it-beginner --level beginner --language it \
  --title "<paper title>"
```

It batches through Ollama's HTTP API the same way you would (whole-paper context, ~18 blocks per call), retries paragraphs the model drops from a batch, and writes straight into `paragraphs.json`. It only fills paragraphs missing that variant key, so it's safe to re-run (use `--force` to regenerate everything). This is a first draft, not a substitute for the writing step above: it occasionally produces a syntactically-fine but useless cop-out ("this isn't covered by the given text") on figure/table-caption paragraphs even when the source text was right there in its batch — always read through the result and rewrite whatever reads as thin, wrong, or evasive before considering the variant done.

Assemble the final `papers/<slug>/paragraphs.json`: array of
```json
{
  "id": "p0000",
  "page": 0,
  "order": 0,
  "section": "Introduction",
  "rects": [[0.12, 0.18, 0.88, 0.24]],
  "sourceText": "...",
  "explanations": {
    "it-beginner": "...",
    "en-expert": "..."
  },
  "notebookSuggestion": "optional"
}
```
`section` comes pre-filled from the extraction (nearest preceding heading) — fix it where a heading was misdetected, and drop the `kind` field (it's scratch info, not part of `paragraphs.json`).

## 4b. Write the glossary (`concepts.json`)

With the whole paper still in context, write `papers/<slug>/concepts.json`: the 15–30 terms, symbols and acronyms a reader at the requested level(s) would stumble on and need again later. The reader underlines the first mention of each concept in every explanation; clicking it shows the definition, related concepts, the same concept in other papers of the library, a jump to the paragraph that introduces it, and a button that highlights every occurrence in the PDF.

```json
[
  {
    "id": "phase-gadget",
    "term": "phase gadget",
    "aliases": ["phase gadgets", "Z-phase gadget"],
    "pdfTerms": ["phase gadget", "phase gadgets", "Z-phase gadget"],
    "kind": "term",
    "definedIn": "p0029",
    "definitions": { "it-intermediate": "...", "it-expert": "..." },
    "related": ["pauli-gadget", "zx-calculus"]
  }
]
```

- **Pick what the paper relies on**, not every noun: its own constructions (defined terms, named lemmas' objects), notation it reuses (`∧X`, `P(α,s)`), and field vocabulary the target level may not know. Skip generic words ("circuito", "qubit" for an intermediate reader) — too many underlines make every note noisy.
- **`term` and `aliases` are matched against the explanation text, not the PDF** — so they must be spelled the way *your explanations* spell them, in the explanation language: include plurals and inflections (`trotterizzato`, `trotterizzati`), the English form if explanations keep it (`zx-calculus` next to `calcolo ZX`), and common variants (`∧X-ladder`). Matching is case-insensitive and whole-word (a letter or digit right before/after blocks a match), longest spelling first. Avoid aliases that are ordinary words in the language (e.g. `passata`).
- **`id` is shared across the library**: an English kebab-case name for the concept itself (`cz-gate`, `rydberg-blockade`, `zx-calculus`), not for this paper's spelling. Before inventing one, check `papers/concepts-index.json` — if another paper already defines the same concept, **reuse its id exactly**; that's what links the two papers in the reader ("Anche in: …"). Conversely, don't reuse an id for a different concept that happens to share a name (e.g. "qubit mapping" as fermion→qubit encoding vs. as layout placement get different ids).
- **`pdfTerms`** are the spellings to highlight *in the PDF* (the paper's own language, usually English), used by "Evidenzia nel PDF". Same matching rules as `aliases`; a space also matches a line break, and a hyphenated line break can be written as `"mul- tiprogramming"`. Math and symbols often come out of pdf.js differently from how they look (e.g. `t|ket〉` with U+3009, `r4(M )` with a space) — find the real spelling with the checker's `--grep`. Keep them specific: `"fidelity"` alone would highlight every mention of the word, not the concept. If omitted, `term` + `aliases` are used, which rarely match an English PDF.
- **`definedIn`** is the `id` of the paragraph where the paper introduces or first properly explains the concept (not just its first passing mention). It must exist in `paragraphs.json`.
- **`definitions`** has one entry per variant, same keys as `explanations`, same level discipline: a definition *in this paper's sense* (its notation, its role in the argument), not a generic encyclopedia entry — that's what makes it better than asking a chatbot. 2–4 sentences.
- **`related`** lists other concept ids from the same file (2–4, the ones a confused reader would want next).
- `kind` is `term`, `symbol`, or `acronym` (informational for now).

Then validate it with the checker, which uses the reader's own matching code and pdf.js text:

```
node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_concepts.mjs <slug>
node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_concepts.mjs <slug> --grep '<regex>'   # find a term's PDF spelling
```

It must end with `OK`: every `definedIn`/`related` resolves, every variant has a definition, every concept is underlined in at least one note and found at least once in the PDF. Also skim the per-concept counts for the opposite problem — a concept underlined in most notes usually has an alias that's an ordinary word (drop it).

Finally regenerate the library-wide index (the build also does this, but dev reads the committed file):

```
npm run concepts-index
```

## 4c. Write recall questions (`recall`)

Add a `recall` array to the paragraphs that carry the paper's argument — its claims, key definitions, mechanisms, headline results and their conditions; roughly one paragraph in six to eight, 15–25 questions for a typical paper. The reader reviews them with spaced repetition (`/review`): a reader who marks such a paragraph "Da ripassare" gets these questions instead of a generic "explain paragraph N".

```json
"recall": [
  { "id": "r1",
    "q": { "it-intermediate": "Perché …?", "it-expert": "Quale trade-off …?" },
    "a": { "it-intermediate": "…", "it-expert": "…" } }
]
```

- One question per idea, answerable from *this* paragraph (the answer view links back to it). Ask for the why/how and the numbers that matter, not for recall of wording; avoid yes/no.
- Same level discipline as explanations: intermediate asks for the mechanism in plain terms, expert for the precise statement, conditions, trade-offs and figures. Answers are 1–3 sentences.
- `id` is unique within the paragraph (`r1`, `r2`, …) — card ids depend on it, so don't renumber existing questions.
- `check_paper.py` validates them (unique ids, question and answer for every variant).

For an already-imported paper, the same can be added on its own: read `paragraphs.json`, add `recall` to the chosen paragraphs, run the checker. Nothing else changes.

## 4d. Write the argument map (`structure.json`)

Write `papers/<slug>/structure.json`: the paper's thesis and the 5–8 claims that carry it. The reader shows it as the "Mappa" tab (thesis, then each claim with where it's stated, its evidence, and what it builds on), labels notes "Enuncia C2" / "Prova per C3", and the toolbar's "Il filo" dims every paragraph that neither states nor supports a claim — so the map is also the paper's quick reading path.

```json
{
  "thesis": { "it-intermediate": "…", "it-expert": "…" },
  "claims": [
    { "id": "czswap",
      "title":   { "it-intermediate": "…", "it-expert": "…" },
      "summary": { "it-intermediate": "…", "it-expert": "…" },
      "statedIn": ["p0043", "p0060"],
      "evidence": ["p0229", "p0101"],
      "dependsOn": ["ptn"] }
  ]
}
```

- **Thesis**: one or two sentences — what the paper shows and why it matters, at each variant's level.
- **Claims** are the paper's own assertions (a construction works, a bound holds, a method beats a baseline, a limitation), not topics or section names. List them in the order the argument builds them (they're numbered C1…Cn in that order). `title` is the claim itself as a short sentence; `summary` says what it rests on and why it matters.
- `statedIn`: the paragraph(s) where the paper asserts it (abstract/intro mentions only if that's where it's really stated; prefer the body). `evidence`: the paragraphs that establish it — definitions it needs, derivations, proofs, experiments, figures' captions of results. Both must be real paragraph ids.
- `dependsOn`: claims this one needs (no cycles). Keep the graph honest — a results claim usually depends on the method claim.
- **Size the thread**: statedIn ∪ evidence across claims is "Il filo". Aim for roughly 20–35% of the paragraphs — enough to follow the argument end to end, few enough to read in ten minutes. Leave out background, related work, notation-only paragraphs, acknowledgments.
- `check_paper.py` validates it (variants, ids, cycles) and prints how much of the paper the thread covers.

For an already-imported paper, write it on its own from `paragraphs.json` (whole-paper read first); nothing else changes.

## 4e. Write the TL;DR ("In breve")

After the whole paper is read (and the argument map written — its thesis and claims are the best raw material), write `tldr` for `meta.json`: the paper in brief, shown as the "In breve" strip under the reader's toolbar (the `idea` alone on one line, every field in its drop-down) and, as problem + idea, on the library card.

```json
"tldr": {
  "it": {
    "problem": "…",
    "idea": "…",
    "result": "…",
    "why": "…"
  }
}
```

- **Always plain language, whatever the variants' levels** — even an expert-level import gets a TL;DR a reader with no background can follow. It's the way in, not the map; the thesis in `structure.json` is where the technical summary goes.
- Keyed by **language** (not variant): one entry per language among `meta.json`'s `variants`.
- Fixed fields, 1–2 sentences each: `problem` (what doesn't work today — an everyday analogy instead of jargon), `idea` (what the authors propose), `result` (what they get, with numbers made tangible: "cento volte più affidabile", not "fidelity 1.2e-2 vs 1.1e-4"), `why` (optional: who it matters to and what it leaves open — be honest about limits).
- Any unavoidable technical word (qubit, QFT…) gets a few-word gloss or is left as a name, never as the thing the sentence hinges on.
- `check_paper.py` checks every language has the three required fields.

For an already-imported paper, write it on its own from `structure.json` + `paragraphs.json` and add it to both `meta.json` and the paper's `index.json` entry.

## 4f. Write deep dives (`deepDive`)

Some paragraphs need more than a 2–4 sentence note: definitions of notation, equations, derivations, algorithm steps, passages that lean on a reference or an earlier section. For these, add a `deepDive` — a long-form explanation shown collapsed under the note ("Approfondisci ▸"), rendered as markdown with KaTeX math.

```json
"deepDive": { "it-intermediate": "### Titolo\nTesto con $\\ell_t\\triangle\\ell_c$ e\n$$C\\odot R_Z\\odot C^\\dagger$$\n… vedi [par. 17](#p0025).\n\n> **Da portarti dietro:** …" }
```

- **Which paragraphs**: roughly 15–25% of the paper, never all. Good signals: dense math in `sourceText`, paragraphs that introduce notation or definitions (`definedIn` in `concepts.json`), paragraphs where a claim is stated or proved (`statedIn`/`evidence` in `structure.json`), equations the rest of the paper keeps using, anything that says "see Ref. [n]" for something the reader needs. Skip captions, related work, prose that the short note already covers. A foundational section can have a much higher share than the average.
- **Self-contained**: resolve every reference instead of pointing at it — say what Eq. (3) states, what the cited result is, what the earlier definition was. External prerequisites the paper takes for granted (a formalism, a standard identity, a convention like $R_Z(\alpha)=e^{-i\alpha Z}$ vs Qiskit's $e^{-i\theta Z/2}$) get a short "Cosa ti serve sapere" part. Link paragraphs of the same paper as `[par. N](#<id>)` — N is the reader's badge number (1-based reading order); the link scrolls both panes there.
- **Shape** (what made chat-assistant explanations useful, with the whole-paper context they lack): 2–4 `###` sections; a **worked example with small concrete numbers** you actually computed (label sequences, bit strings, a 3-qubit circuit — verify with a quick script when it involves search or counting); where the idea is used later in the paper and why it matters there; end with one `> **Da portarti dietro:** …` line. Don't re-teach what a variant's level already knows, and don't restate the short note.
- **Length**: 150–400 words per variant. Same level discipline as explanations; one entry per variant in `meta.json` (a missing key just means no deep dive for that variant).
- Math: `$…$` inline (no space just inside the dollars), `$$…$$` display. Markdown tables are fine (they scroll horizontally in the narrow notes column); don't put `|` inside math in a table cell.
- Validate with:
  ```
  node --experimental-strip-types --no-warnings .claude/skills/import-paper/scripts/check_deep_dives.mjs <slug>
  ```
  It must end with `OK` (unknown variant keys, KaTeX errors, links to missing paragraphs, a "par. N" text that doesn't match its target's number, unbalanced `$`); it also prints word counts.

For an already-imported paper, add deep dives on their own, section by section: read the whole `paragraphs.json` first (forward links need it), write `deepDive` into the chosen paragraphs, run the checker. Nothing else changes.

## 5. Write meta.json and update the library index

`papers/<slug>/meta.json`:
```json
{
  "slug": "...",
  "title": "...",
  "authors": ["..."],
  "importedAt": "<ISO 8601 timestamp>",
  "language": "...",
  "background": "...",
  "sourceType": "arxiv|url|local",
  "sourceRef": "...",
  "pageCount": N,
  "variants": [
    { "key": "it-beginner", "language": "it", "level": "beginner", "label": "Italiano · Nessun background" }
  ],
  "tldr": { "it": { "problem": "…", "idea": "…", "result": "…", "why": "…" } }
}
```
`language`/`background` at the top level mirror the *first* generated variant (used by the library card); `variants` lists every combination actually present in `paragraphs.json`, in the order they should appear in the reader's selector. Label format: `"<Language name> · <level phrase>"` — level phrases: beginner → "Nessun background" / "No background", intermediate → "Laurea in campo affine" / "Adjacent-field grad level", expert → "Esperto nel sottocampo" / "Expert in this subfield" (match the label's own language to that variant's language).

Then update `papers/index.json` (array of `{slug, title, authors, importedAt, language, background, pageCount, variants, tldr}`, mirroring the corresponding fields from `meta.json`) — append a new entry, or replace the existing one if this slug was already there (re-import). The library homepage reads `pageCount`/`variants`/`tldr` straight off this file, so keep them byte-for-byte in sync with `meta.json`.

## Importing from a GitHub issue (paper requests)

Readers request papers through GitHub issues (form `.github/ISSUE_TEMPLATE/paper-request.yml`, label `paper-request`; the reader's citation popover opens it prefilled). The protocol for requesters is `docs/paper-requests.md`; this is the importer's side.

1. **Read it**: `gh issue view <N>` (list open ones with `gh issue list --label paper-request`). The form gives *Riferimento* (required), *Link*, *Livello*, *Lingua*, *Citato in*. Level and language are the interview answers of step 1 — don't ask again.
2. **Identify the paper**:
   ```
   uv run .claude/skills/import-paper/scripts/find_paper.py "<link, or the reference text>"
   ```
   It tries an arXiv id/URL in the text, then a DOI, then an arXiv title search (quoted title, or the text after "Authors (Year):"), and prints candidates with a title-similarity score, the arXiv licence, and whether the paper is already in the library. Below 0.8, confirm authors and year by hand. No arXiv hit: try the DOI / publisher page, then a web search (Google Scholar has no API); still nothing → comment asking for a link, add label `needs-link`, stop.
3. **Duplicates**: already in the library at the requested level → comment with its link, label `duplicate`, close. Already there but not at that level/language → do **Adding a variant** below instead of a new import.
4. **Licence** — the library republishes the PDF verbatim, so it must be redistributable: CC BY / CC BY-SA / CC0 (the arXiv abs page, or the publisher for open-access journals). arXiv's default `nonexclusive-distrib` licence is **not** enough: look for an open-access publisher version (e.g. Quantum, PRX/PR Research, EPTCS are CC BY) and import that URL instead; if none, comment explaining why, label `license-blocked`, close. Record the licence you relied on in the issue comment.
5. **Import** with the normal steps 2–5 (explanations, glossary, recall questions, argument map, TL;DR, deep dives, `meta.json`/`index.json`, `npm run concepts-index`) and the checkers (`check_paper.py`, `check_concepts.mjs`).
6. **Close the loop**: commit with `Closes #<N>` in the message; comment on the issue with `https://theghoul21.github.io/paper-reader/paper/<slug>` (live after the deploy).

## Adding a variant to an already-imported paper

Given a slug that already exists and a new (language, level) not yet in its `meta.json` `variants`:

1. Read the existing `papers/<slug>/paragraphs.json` directly — it already has correctly curated `sourceText` per paragraph (merged/reordered/cleaned). **Do not re-run `extract_blocks.py` or redo the curation.**
2. Read all `sourceText` fields once for whole-paper context, then write the new `explanations["<language>-<level>"]` per paragraph the same batched way as step 4 above, merging into each entry's existing `explanations` object (don't touch other keys). This step is a good candidate for the local-model draft path described in step 4 — it already operates directly on `paragraphs.json` and only fills the missing variant.
3. Append the new variant to `meta.json`'s `variants` array. Leave `language`/`background` (the default/first variant) and everything else unchanged.
4. Append the same new variant to this paper's entry in `papers/index.json` (its `variants` array must mirror `meta.json`'s) — everything else in that entry is unchanged.

5. If the paper has a `concepts.json`, add the new variant's key to every concept's `definitions` too (same level discipline as step 4b), and add aliases in the new language if the variant is in a different language — otherwise terms won't be matched in the new explanations.

This is the cheap path — never regenerate `rects`/`page`/`order`/`sourceText` when only adding a variant.

## Adding a glossary to an already-imported paper

Papers imported before step 4b existed have no `concepts.json` (the reader works fine without one — just no underlined terms). To add it: read `paragraphs.json` (`sourceText` for the paper's argument, `explanations` for the spellings to match), then write `concepts.json` as in step 4b, for every variant in `meta.json` — including the checker and `npm run concepts-index`. Nothing else changes — `meta.json`, `index.json` and `paragraphs.json` stay as they are.

## Do NOT

- Don't hand-write `rects`/`page`/`order` — those come only from `extract_blocks.py`'s output (you may reorder/delete/merge entries, but positions must stay grounded in the actual extraction).
- Don't build a notebook — leave `notebookSuggestion` instead.
- Don't skip the reading-order sanity check in step 3; a wrong order silently produces a confusing reader experience with no error.
- Don't silently generate more than one variant — that's a real cost multiplier the user should knowingly opt into.
