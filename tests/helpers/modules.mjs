import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

// Compile the actual TS/TSX modules, keeping the same React instance as the renderer.
// Only browser facilities and explicitly named dependencies are substituted.
export function loadModule(file, { globals = {}, mocks = {} } = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(path);
    if (path in mocks) return mocks[path];
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const source = readFileSync(path, "utf8").replace(/import\.meta\.env\.BASE_URL/g, '"/"');
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const require = (name) => {
      if (name in mocks) return mocks[name];
      if (!name.startsWith(".")) return nativeRequire(name);
      let target = resolve(dirname(path), name);
      if (!/\.(?:tsx?|mjs|json)$/.test(target)) {
        try { readFileSync(`${target}.ts`); target += ".ts"; }
        catch { target += ".tsx"; }
      }
      return load(target);
    };
    vm.runInNewContext(code, {
      module, exports: module.exports, require, console, Date, Event, AbortController, DOMException,
      setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, ...globals,
    }, { filename: path });
    return module.exports;
  }
  return load(file);
}

export function memoryStorage() {
  const entries = new Map();
  return {
    get length() { return entries.size; },
    key: (i) => [...entries.keys()][i] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
    clear: () => entries.clear(),
  };
}

export const flush = () => new Promise((resolve) => setImmediate(resolve));
