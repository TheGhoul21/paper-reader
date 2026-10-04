import type { Annotation } from "../types";
import type { ReviewCard } from "./review";
import type { GuidedReadingProgress } from "./guidedReading";

export const USER_DATA_KEY = "paper-reader:user-data";
export const LEGACY_REVIEW_KEY = "paper-reader:review";
export const ANNOTATIONS_PREFIX = "paper-reader:annotations:";

export interface UserData {
  review: Record<string, ReviewCard>;
  annotations: Record<string, Annotation[]>;
  reading?: Record<
    string,
    { page: number; paragraphId: string | null; variant: string; updatedAt: string }
  >;
  preferences?: { fontSize: number; panelWidth: number };
  journeys?: Record<string, GuidedReadingProgress>;
}
export interface UserDataSnapshot {
  data: UserData;
  error: string | null;
  unsaved: boolean;
  readFailed?: boolean;
}
export interface StorageAccess {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function string(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function date(value: unknown): boolean {
  return string(value) && Number.isFinite(Date.parse(value));
}
function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function integer(value: unknown): boolean {
  return number(value) && Number.isInteger(value) && value >= 0;
}
function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(string) && new Set(value).size === value.length;
}

/** Validate the complete import before it is allowed to change any stored data. */
export function validateUserData(value: unknown): UserData {
  if (!record(value) || !record(value.review) || !record(value.annotations))
    throw new Error("Backup non valido: mancano ripasso o annotazioni.");
  if (value.journeys !== undefined) {
    if (!record(value.journeys)) throw new Error("Percorsi di lettura non validi.");
    for (const [slug, journey] of Object.entries(value.journeys)) {
      if (!slug || !record(journey)) throw new Error(`Percorso di lettura non valido: ${slug}.`);
      const { explored, doubts } = journey;
      if (
        !["reading", "summary"].includes(String(journey.phase)) ||
        !string(journey.stepId) ||
        !string(journey.variant) ||
        !uniqueStrings(explored) ||
        !uniqueStrings(doubts) ||
        doubts.some((id) => !explored.includes(id)) ||
        typeof journey.reflection !== "string" ||
        !number(journey.scrollY) ||
        journey.scrollY < 0 ||
        !date(journey.updatedAt)
      )
        throw new Error(`Percorso di lettura non valido: ${slug}.`);
    }
  }
  if (value.reading !== undefined) {
    if (!record(value.reading)) throw new Error("Posizioni di lettura non valide.");
    for (const item of Object.values(value.reading)) {
      if (
        !record(item) ||
        !integer(item.page) ||
        Number(item.page) < 1 ||
        (item.paragraphId !== null && !string(item.paragraphId)) ||
        !string(item.variant) ||
        !date(item.updatedAt)
      )
        throw new Error("Posizione di lettura non valida.");
    }
  }
  if (
    value.preferences !== undefined &&
    (!record(value.preferences) ||
      !number(value.preferences.fontSize) ||
      value.preferences.fontSize < 14 ||
      value.preferences.fontSize > 24 ||
      !number(value.preferences.panelWidth) ||
      value.preferences.panelWidth < 320 ||
      value.preferences.panelWidth > 600)
  )
    throw new Error("Preferenze di lettura non valide.");
  for (const [id, c] of Object.entries(value.review)) {
    if (
      !record(c) ||
      !string(c.slug) ||
      !string(c.refId) ||
      !string(c.variant) ||
      !["concept", "paragraph", "question"].includes(String(c.kind)) ||
      c.id !== id ||
      id !== `${c.slug}:${c.kind}:${c.refId}` ||
      !date(c.addedAt) ||
      !date(c.due) ||
      !number(c.interval) ||
      c.interval < 0 ||
      !number(c.ease) ||
      c.ease < 1.3 ||
      !integer(c.reps) ||
      !integer(c.lapses) ||
      (c.updatedAt !== undefined && !date(c.updatedAt))
    )
      throw new Error(`Card di ripasso non valida: ${id}.`);
  }
  for (const [slug, list] of Object.entries(value.annotations)) {
    if (!slug || !Array.isArray(list)) throw new Error(`Annotazioni non valide: ${slug}.`);
    const ids = new Set<string>();
    for (const a of list) {
      if (
        !record(a) ||
        !string(a.id) ||
        ids.has(a.id) ||
        !integer(a.page) ||
        !string(a.color) ||
        !/^#[\da-f]{6}$/i.test(a.color) ||
        !date(a.createdAt) ||
        (a.updatedAt !== undefined && !date(a.updatedAt))
      )
        throw new Error(`Annotazione non valida: ${slug}.`);
      ids.add(a.id);
      if (a.type === "text") {
        if (!number(a.x) || !number(a.y) || typeof a.text !== "string")
          throw new Error(`Nota non valida: ${a.id}.`);
      } else if (a.type === "freehand") {
        if (
          !number(a.strokeWidth) ||
          a.strokeWidth <= 0 ||
          !Array.isArray(a.points) ||
          a.points.length < 2 ||
          a.points.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(number))
        )
          throw new Error(`Disegno non valido: ${a.id}.`);
      } else throw new Error(`Tipo di annotazione non valido: ${a.id}.`);
    }
  }
  return value as unknown as UserData;
}

/** One localStorage write commits the entire deck and all annotations atomically. */
export class UserDataStore {
  private snapshot: UserDataSnapshot | null = null;
  private lastRaw: string | null = null;
  private listeners = new Set<() => void>();
  constructor(private readonly storage: () => StorageAccess) {}

  private read(): UserDataSnapshot {
    try {
      const storage = this.storage();
      const raw = storage.getItem(USER_DATA_KEY);
      this.lastRaw = raw;
      if (raw !== null) {
        const envelope: unknown = JSON.parse(raw);
        if (!record(envelope) || envelope.version !== 2)
          throw new Error("Versione dei dati salvati non riconosciuta.");
        return { data: validateUserData(envelope), error: null, unsaved: false };
      }
      // Migrate existing browsers on the first successful write; keep their original keys intact.
      const data: UserData = {
        review: JSON.parse(storage.getItem(LEGACY_REVIEW_KEY) ?? "{}"),
        annotations: {},
      };
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(ANNOTATIONS_PREFIX))
          data.annotations[key.slice(ANNOTATIONS_PREFIX.length)] = JSON.parse(
            storage.getItem(key) ?? "[]",
          );
      }
      return { data: validateUserData(data), error: null, unsaved: false };
    } catch (error) {
      return {
        data: { review: {}, annotations: {} },
        error: `Impossibile leggere i dati salvati; saranno conservati senza sovrascriverli. ${String(error)}`,
        unsaved: false,
        readFailed: true,
      };
    }
  }

  getSnapshot = (): UserDataSnapshot => (this.snapshot ??= this.read());
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }

  reload = () => {
    // Another tab must not discard work that this tab has not been able to save.
    if (this.snapshot?.unsaved) return;
    this.snapshot = this.read();
    this.notify();
  };

  update(fn: (data: UserData) => UserData, requirePersistence = false): void {
    let snapshot = this.getSnapshot();
    if (snapshot.readFailed) {
      if (requirePersistence)
        throw new Error("Importazione annullata: impossibile leggere i dati esistenti.");
      return;
    }
    if (!snapshot.unsaved) {
      try {
        if (this.storage().getItem(USER_DATA_KEY) !== this.lastRaw)
          snapshot = this.snapshot = this.read();
      } catch {
        /* The attempted write below will report unavailable storage. */
      }
    }
    if (snapshot.readFailed) {
      this.notify();
      if (requirePersistence)
        throw new Error("Importazione annullata: impossibile leggere i dati esistenti.");
      return;
    }
    const next = validateUserData(fn(snapshot.data));
    const raw = JSON.stringify({ version: 2, ...next });
    try {
      this.storage().setItem(USER_DATA_KEY, raw);
      this.lastRaw = raw;
      this.snapshot = { data: next, error: null, unsaved: false };
    } catch (error) {
      const message =
        "Il browser non ha salvato le modifiche. Esporta un backup prima di chiudere questa pagina.";
      this.snapshot = requirePersistence
        ? { ...snapshot, error: message }
        : { data: next, error: message, unsaved: true };
      this.notify();
      if (requirePersistence)
        throw new Error(`Importazione annullata: ${message}`, { cause: error });
      return;
    }
    this.notify();
  }

  retry = () => {
    if (this.getSnapshot().readFailed) this.reload();
    else this.update((data) => data);
  };
}
