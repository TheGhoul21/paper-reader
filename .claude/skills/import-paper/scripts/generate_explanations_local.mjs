#!/usr/bin/env node
// Draft-generates paragraph explanations for one variant using a local Ollama model,
// instead of writing them inline in the agent session. See SKILL.md step 4 / "Adding a variant".
//
// Usage:
//   node generate_explanations_local.mjs papers/<slug>/paragraphs.json \
//     --variant it-beginner --level beginner --language it --title "Paper Title" \
//     [--model qwen3.5:4b] [--batch-size 18] [--host http://localhost:11434] [--force]

import { readFileSync, writeFileSync } from "node:fs";

const LEVEL_GUIDANCE = {
  beginner: "Nessun background nel campo: evita gergo tecnico non spiegato, usa analogie semplici, spiega ogni termine specialistico la prima volta che compare.",
  intermediate: "Livello laurea in un campo affine: puoi usare terminologia tecnica di base senza definirla, ma spiega i concetti specifici di questo sottocampo.",
  expert: "Esperto in questo esatto sottocampo: sii denso, assumi tutto il vocabolario tecnico, concentrati su cosa c'è di realmente nuovo rispetto allo stato dell'arte, non spiegare le basi.",
};

function parseArgs(argv) {
  const args = { batchSize: 18, model: "qwen3.5:4b", host: "http://localhost:11434", force: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variant") args.variant = argv[++i];
    else if (a === "--level") args.level = argv[++i];
    else if (a === "--language") args.language = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--batch-size") args.batchSize = parseInt(argv[++i], 10);
    else if (a === "--host") args.host = argv[++i];
    else if (a === "--force") args.force = true;
    else positional.push(a);
  }
  args.paragraphsPath = positional[0];
  return args;
}

function validate(args) {
  const errors = [];
  if (!args.paragraphsPath) errors.push("missing <paragraphs.json path>");
  if (!args.variant) errors.push("missing --variant (e.g. it-beginner)");
  if (!args.level || !LEVEL_GUIDANCE[args.level]) errors.push(`--level must be one of: ${Object.keys(LEVEL_GUIDANCE).join(", ")}`);
  if (!args.language) errors.push("missing --language (e.g. it, en)");
  if (!args.title) errors.push("missing --title (the paper's title, for context)");
  if (errors.length) {
    console.error("Usage: generate_explanations_local.mjs <paragraphs.json> --variant <key> --level <beginner|intermediate|expert> --language <lang> --title <title> [--model qwen3.5:4b] [--batch-size 18] [--host http://localhost:11434] [--force]\n");
    console.error(errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildPrompt({ title, language, level, fullPaperText, batch }) {
  const batchBlock = batch.map((p) => `[${p.id}]${p.section ? ` (${p.section})` : ""}\n${p.sourceText}`).join("\n\n");
  return `Stai scrivendo, per un lettore di paper accademici, una spiegazione in linguaggio semplice per ogni paragrafo del PDF, mostrata accanto al testo originale.

Paper: "${title}"
Lingua della spiegazione: ${language}
Livello del lettore: ${LEVEL_GUIDANCE[level]}

Testo completo del paper (contesto, in ordine di lettura):
"""
${fullPaperText}
"""

Scrivi ora la spiegazione SOLO per questi paragrafi (identificati dal loro id):

${batchBlock}

Regole:
- Voci bibliografiche, note biografiche o altro materiale di contorno: spiegazione breve e onesta (es. "Riferimento citato per il confronto con X"), non inventare profondità che non c'è.
- Non ripetere il testo originale, spiegalo.
- Rispondi SOLO con un oggetto JSON che mappa ogni id del batch alla sua spiegazione in stringa, nient'altro. Esempio: {"${batch[0].id}": "..."}`;
}

async function callOllama(host, model, prompt) {
  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false, think: false, format: "json", options: { num_ctx: 32768, num_predict: 8192 } }),
  });
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.response);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validate(args);

  const paragraphs = JSON.parse(readFileSync(args.paragraphsPath, "utf8"));
  const fullPaperText = paragraphs.map((p) => `[${p.id}] ${p.sourceText}`).join("\n");

  const todo = args.force ? paragraphs : paragraphs.filter((p) => !p.explanations?.[args.variant]);
  if (todo.length === 0) {
    console.log(`Nothing to do: every paragraph already has "${args.variant}" (use --force to regenerate).`);
    return;
  }

  const byId = new Map(paragraphs.map((p) => [p.id, p]));
  let filled = 0;

  async function runPass(items, batchSize, label) {
    const batches = chunk(items, batchSize);
    const stillMissing = [];
    for (const [i, batch] of batches.entries()) {
      const t0 = Date.now();
      const prompt = buildPrompt({ title: args.title, language: args.language, level: args.level, fullPaperText, batch });
      let result;
      try {
        result = await callOllama(args.host, args.model, prompt);
      } catch (err) {
        console.error(`${label} batch ${i + 1}/${batches.length} failed: ${err.message}`);
        stillMissing.push(...batch);
        continue;
      }

      for (const p of batch) {
        const explanation = result[p.id];
        if (typeof explanation !== "string" || !explanation.trim()) {
          stillMissing.push(p);
          continue;
        }
        const target = byId.get(p.id);
        target.explanations = target.explanations ?? {};
        target.explanations[args.variant] = explanation.trim();
        filled++;
      }

      writeFileSync(args.paragraphsPath, JSON.stringify(paragraphs, null, 2) + "\n");
      console.log(`  ${label} batch ${i + 1}/${batches.length}: ${batch.length} paragraphs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    return stillMissing;
  }

  console.log(`Generating "${args.variant}" for ${todo.length} paragraphs, model ${args.model} (thinking off).`);
  let missing = await runPass(todo, args.batchSize, "pass 1");

  // The model sometimes closes the JSON early (hitting its output-length limit) before
  // covering every id in a large batch — one retry pass with smaller batches recovers those.
  if (missing.length > 0) {
    console.log(`${missing.length} paragraph(s) missing after pass 1, retrying with smaller batches...`);
    missing = await runPass(missing, Math.max(4, Math.floor(args.batchSize / 3)), "retry");
  }

  if (missing.length > 0) {
    console.warn(`Still missing after retry: ${missing.map((p) => p.id).join(", ")}`);
  }

  console.log(`Done: ${filled}/${todo.length} explanations written to ${args.paragraphsPath}.`);
  console.log(`This is a first-pass draft — spot-check a sample (especially math-heavy or table paragraphs) before treating it as final.`);
}

main();
