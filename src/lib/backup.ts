import type { Annotation } from "../types";
import type { ReviewCard } from "./review";
import { userDataStore } from "./storage.ts";
import { validateUserData, type UserData } from "./userData.ts";

// Everything the reader keeps only in this browser's localStorage — the review deck and every
// paper's annotations — as one JSON file, so it can be moved to another browser or device.

export interface Backup {
  app: "paper-reader";
  version: 1;
  exportedAt: string;
  review: Record<string, ReviewCard>;
  annotations: Record<string, Annotation[]>; // by paper slug
  reading?: UserData["reading"];
  preferences?: UserData["preferences"];
  journeys?: UserData["journeys"];
}

export function exportBackup(): Backup {
  const snapshot = userDataStore.getSnapshot();
  if (snapshot.readFailed)
    throw new Error("Impossibile esportare: i dati salvati non sono leggibili.");
  return {
    ...snapshot.data,
    app: "paper-reader",
    version: 1,
    exportedAt: new Date().toISOString(),
  };
}

export function downloadBackup() {
  downloadBackupFile(exportBackup());
}

/** Also accepts a partial backup when the guided session must recover new work separately. */
export function downloadBackupFile(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paper-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Merges a backup into this browser's data (never deletes). Review cards: a card missing here is
 * added; conflicts keep the latest updatedAt. An unversioned legacy record never overwrites
 * an existing record because its actual last modification is unknown.
 */
export function importBackup(data: unknown): {
  cards: number;
  annotations: number;
  journeys: number;
} {
  const backup = data as Partial<Backup>;
  if (backup?.app !== "paper-reader" || backup.version !== 1)
    throw new Error("Non è un backup di paper reader.");

  const incoming = validateUserData({
    review: backup.review,
    annotations: backup.annotations,
    reading: backup.reading,
    preferences: backup.preferences,
    journeys: backup.journeys,
  });
  let cards = 0,
    annotations = 0,
    journeys = 0;
  const newer = (a: { updatedAt?: string }, b: { updatedAt?: string }) =>
    a.updatedAt !== undefined &&
    (b.updatedAt === undefined || Date.parse(a.updatedAt) > Date.parse(b.updatedAt));
  userDataStore.update((data) => {
    const review = { ...data.review };
    const notes = { ...data.annotations };
    for (const [id, card] of Object.entries(incoming.review)) {
      if (!review[id] || newer(card, review[id])) {
        review[id] = card;
        cards++;
      }
    }
    for (const [slug, list] of Object.entries(incoming.annotations)) {
      const merged = new Map((notes[slug] ?? []).map((a) => [a.id, a]));
      for (const a of list) {
        const current = merged.get(a.id);
        if (!current || newer(a, current)) {
          merged.set(a.id, a);
          annotations++;
        }
      }
      notes[slug] = [...merged.values()];
    }
    const reading = { ...data.reading };
    for (const [slug, position] of Object.entries(incoming.reading ?? {})) {
      if (!reading[slug] || newer(position, reading[slug])) reading[slug] = position;
    }
    const mergedJourneys = { ...data.journeys };
    for (const [slug, journey] of Object.entries(incoming.journeys ?? {})) {
      if (!mergedJourneys[slug] || newer(journey, mergedJourneys[slug])) {
        mergedJourneys[slug] = journey;
        journeys++;
      }
    }
    return {
      ...data,
      review,
      annotations: notes,
      reading,
      preferences: data.preferences ?? incoming.preferences,
      journeys: mergedJourneys,
    };
  }, true);
  return { cards, annotations, journeys };
}
