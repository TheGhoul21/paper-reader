import { useEffect, useState } from "react";
import { papersUrl } from "./paths";
import { parseCatalog, type Catalog } from "./catalog";

let cached: Catalog | null = null;

/** One compact manifest; the homepage never fetches paragraph JSON, glossaries or PDFs. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (cached) {
      setCatalog(cached);
      return;
    }
    const controller = new AbortController();
    setError(null);
    fetch(papersUrl("catalog-index.json"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((value: unknown) => {
        const parsed = parseCatalog(value);
        if (!controller.signal.aborted) {
          cached = parsed;
          setCatalog(parsed);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(String(reason));
      });
    return () => controller.abort();
  }, [attempt]);
  return { catalog, error, retry: () => setAttempt((value) => value + 1) };
}
