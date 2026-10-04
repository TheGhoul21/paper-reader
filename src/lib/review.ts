import { useCallback, useEffect, useState } from "react";
import { userDataStore, useUserData } from "./storage.ts";

// Spaced-repetition review across the whole library. Cards are created by the reader while
// reading (a glossary concept, or a paragraph marked as unclear) and live only in this browser's
// localStorage, like annotations — per device, not part of papers/.

export type CardKind = "concept" | "paragraph" | "question";

export interface ReviewCard {
  id: string; // `${slug}:${kind}:${refId}`
  kind: CardKind;
  slug: string;
  /** Concept id, paragraph id, or `<paragraphId>#<questionId>` for a recall question. */
  refId: string;
  /** The explanation variant being read when the card was added — the answer is shown in it. */
  variant: string;
  addedAt: string;
  /** Last scheduling change; reps resets after a failed recall and cannot order backups. */
  updatedAt?: string;
  /** When the card is next due (ISO). */
  due: string;
  /** Current interval in days (0 = still learning). */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export type Grade = "again" | "hard" | "good" | "easy";

const DAY = 24 * 60 * 60 * 1000;
const RELEARN_DELAY = 10 * 60 * 1000; // a forgotten card comes back in the same session
const HARD_FIRST_DELAY = 6 * 60 * 60 * 1000; // "hard" on a card not yet learned: later today, not tomorrow
const MIN_EASE = 1.3;

export function cardId(slug: string, kind: CardKind, refId: string): string {
  return `${slug}:${kind}:${refId}`;
}

/**
 * Next scheduling state after grading a card (simplified SM-2): "again" relearns it within
 * minutes and lowers ease; "hard" on a card still being learned brings it back in a few hours;
 * otherwise the interval grows (1 day, then 3, then × ease).
 */
export function schedule(card: ReviewCard, grade: Grade, now = new Date()): ReviewCard {
  let { interval, ease } = card;
  const { reps, lapses } = card;
  if (grade === "again") {
    return {
      ...card,
      updatedAt: now.toISOString(),
      interval: 0,
      ease: Math.max(MIN_EASE, ease - 0.2),
      reps: 0,
      lapses: lapses + 1,
      due: new Date(now.getTime() + RELEARN_DELAY).toISOString(),
    };
  }
  if (grade === "hard" && reps === 0) {
    return {
      ...card,
      updatedAt: now.toISOString(),
      ease: Math.max(MIN_EASE, ease - 0.15),
      due: new Date(now.getTime() + HARD_FIRST_DELAY).toISOString(),
    };
  }
  const base = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
  if (grade === "hard") {
    interval = Math.max(1, Math.round(Math.max(interval, 1) * 1.2));
    ease = Math.max(MIN_EASE, ease - 0.15);
  } else if (grade === "good") {
    interval = base;
  } else {
    interval = Math.round(base * 1.3) + 1;
    ease = ease + 0.15;
  }
  return {
    ...card,
    updatedAt: now.toISOString(),
    interval,
    ease,
    reps: reps + 1,
    due: new Date(now.getTime() + interval * DAY).toISOString(),
  };
}

/** Human label for the interval a grade would give, e.g. "10 min", "3 g". */
export function previewInterval(card: ReviewCard, grade: Grade): string {
  const next = schedule(card, grade);
  const ms = new Date(next.due).getTime() - Date.now();
  if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (ms < DAY) return `${Math.round(ms / 3600000)} h`;
  const days = Math.round(ms / DAY);
  return days < 31 ? `${days} g` : `${Math.round(days / 30)} mesi`;
}

export function isDue(card: ReviewCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** How many cards are due now, refreshed every minute (for badges/banners). */
export function useDueCount(): number {
  const { cards } = useReview();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return Object.values(cards).filter((c) => isDue(c, now)).length;
}

/** The review deck: all cards, plus add/remove/grade. Instances stay in sync across the tab and other tabs. */
export function useReview() {
  const {
    data: { review: cards },
  } = useUserData();

  const update = useCallback(
    (fn: (prev: Record<string, ReviewCard>) => Record<string, ReviewCard>) => {
      userDataStore.update((data) => ({ ...data, review: fn(data.review) }));
    },
    [],
  );

  /** Adds cards (skipping ones already in the deck, which keep their schedule). */
  const addCards = useCallback(
    (items: { slug: string; kind: CardKind; refId: string; variant: string }[]) => {
      update((prev) => {
        const next = { ...prev };
        const now = new Date().toISOString();
        for (const { slug, kind, refId, variant } of items) {
          const id = cardId(slug, kind, refId);
          // Due immediately: the first review is the first recall attempt.
          if (!next[id])
            next[id] = {
              id,
              kind,
              slug,
              refId,
              variant,
              addedAt: now,
              updatedAt: now,
              due: now,
              interval: 0,
              ease: 2.5,
              reps: 0,
              lapses: 0,
            };
        }
        return next;
      });
    },
    [update],
  );

  const addCard = useCallback(
    (slug: string, kind: CardKind, refId: string, variant: string) =>
      addCards([{ slug, kind, refId, variant }]),
    [addCards],
  );

  const removeCards = useCallback(
    (ids: string[]) =>
      update((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      }),
    [update],
  );

  const removeCard = useCallback((id: string) => removeCards([id]), [removeCards]);

  const gradeCard = useCallback(
    (id: string, grade: Grade) =>
      update((prev) => (prev[id] ? { ...prev, [id]: schedule(prev[id], grade) } : prev)),
    [update],
  );

  const restoreCard = useCallback(
    (card: ReviewCard) =>
      update((prev) => ({ ...prev, [card.id]: { ...card, updatedAt: new Date().toISOString() } })),
    [update],
  );
  return { cards, addCard, addCards, removeCard, removeCards, gradeCard, restoreCard };
}
