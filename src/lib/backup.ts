import type { Annotation } from "../types";
import { REVIEW_CHANGED_EVENT, REVIEW_STORAGE_KEY, type ReviewCard } from "./review";

// Everything the reader keeps only in this browser's localStorage — the review deck and every
// paper's annotations — as one JSON file, so it can be moved to another browser or device.

const REVIEW_KEY = REVIEW_STORAGE_KEY;
const ANNOTATIONS_PREFIX = "paper-reader:annotations:";

export interface Backup {
  app: "paper-reader";
  version: 1;
  exportedAt: string;
  review: Record<string, ReviewCard>;
  annotations: Record<string, Annotation[]>; // by paper slug
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function exportBackup(): Backup {
  const annotations: Record<string, Annotation[]> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ANNOTATIONS_PREFIX)) annotations[key.slice(ANNOTATIONS_PREFIX.length)] = readJson(key, []);
  }
  return { app: "paper-reader", version: 1, exportedAt: new Date().toISOString(), review: readJson(REVIEW_KEY, {}), annotations };
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paper-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Merges a backup into this browser's data (never deletes). Review cards: a card missing here is
 * added; one present on both sides keeps whichever has been reviewed more (then the later due
 * date). Annotations: union by id, the backup's version winning on conflicts.
 */
export function importBackup(data: unknown): { cards: number; annotations: number } {
  const backup = data as Partial<Backup>;
  if (backup?.app !== "paper-reader" || backup.version !== 1) throw new Error("Non è un backup di paper reader.");

  const review = readJson<Record<string, ReviewCard>>(REVIEW_KEY, {});
  let cards = 0;
  for (const [id, incoming] of Object.entries(backup.review ?? {})) {
    const current = review[id];
    if (!current || incoming.reps > current.reps || (incoming.reps === current.reps && incoming.due > current.due)) {
      review[id] = incoming;
      cards++;
    }
  }
  localStorage.setItem(REVIEW_KEY, JSON.stringify(review));

  let annotations = 0;
  for (const [slug, list] of Object.entries(backup.annotations ?? {})) {
    const key = ANNOTATIONS_PREFIX + slug;
    const merged = new Map(readJson<Annotation[]>(key, []).map((a) => [a.id, a]));
    for (const a of list) {
      merged.set(a.id, a);
      annotations++;
    }
    localStorage.setItem(key, JSON.stringify([...merged.values()]));
  }
  // Let open review hooks pick up the change.
  window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
  return { cards, annotations };
}
