import type { PaperData } from "./papers";
import type { Paragraph, ReadingSection, ReadingStep } from "../types";

/** Study progress records exploration and the reader's doubts, never a mastery score. */
export interface GuidedReadingProgress {
  phase: "reading" | "summary";
  stepId: string;
  variant: string;
  explored: string[];
  doubts: string[];
  reflection: string;
  scrollY: number;
  updatedAt: string;
}

export interface GuidedStop {
  section: ReadingSection;
  step: ReadingStep;
  paragraphs: Paragraph[];
}

export type GuidedReadingAction =
  | { type: "open"; stepId: string; variant: string; phase: GuidedReadingProgress["phase"] }
  | { type: "continue"; stepId: string; nextStepId: string | null; doubt: boolean; variant: string }
  | { type: "reflect"; text: string }
  | { type: "scroll"; stepId: string; phase: GuidedReadingProgress["phase"]; y: number }
  | { type: "variant"; variant: string };

export function guidedStops(data: PaperData): GuidedStop[] {
  const paragraphs = new Map(data.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  return (data.structure?.readingGuide ?? []).flatMap((section) =>
    section.steps.map((step) => ({
      section,
      step,
      paragraphs: step.paragraphs.flatMap((id) => paragraphs.get(id) ?? []),
    })),
  );
}

export function newGuidedProgress(stepId: string, variant: string): GuidedReadingProgress {
  return {
    phase: "reading",
    stepId,
    variant,
    explored: [],
    doubts: [],
    reflection: "",
    scrollY: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Each action changes progress atomically, so advancing cannot lose the doubt just recorded. */
export function updateGuidedProgress(
  progress: GuidedReadingProgress,
  action: GuidedReadingAction,
  now = new Date().toISOString(),
): GuidedReadingProgress {
  switch (action.type) {
    case "open":
      return {
        ...progress,
        stepId: action.stepId,
        phase: action.phase,
        variant: action.variant,
        scrollY: 0,
        updatedAt: now,
      };
    case "continue":
      return {
        ...progress,
        explored: [...new Set([...progress.explored, action.stepId])],
        doubts: action.doubt
          ? [...new Set([...progress.doubts, action.stepId])]
          : progress.doubts.filter((id) => id !== action.stepId),
        stepId: action.nextStepId ?? action.stepId,
        phase: action.nextStepId ? "reading" : "summary",
        variant: action.variant,
        scrollY: 0,
        updatedAt: now,
      };
    case "reflect":
      return { ...progress, reflection: action.text, updatedAt: now };
    case "variant":
      return progress.variant === action.variant
        ? progress
        : { ...progress, variant: action.variant, updatedAt: now };
    case "scroll":
      // A delayed scroll from the previous screen must not overwrite a new destination.
      if (
        progress.stepId !== action.stepId ||
        progress.phase !== action.phase ||
        progress.scrollY === action.y
      )
        return progress;
      return { ...progress, scrollY: Math.max(0, action.y), updatedAt: now };
  }
}

export function guidedUrl(
  slug: string,
  progress?: Pick<GuidedReadingProgress, "phase" | "stepId" | "variant">,
): string {
  if (!progress) return `/paper/${slug}`;
  const query = new URLSearchParams({
    stage: progress.phase === "summary" ? "summary" : "read",
    step: progress.stepId,
    v: progress.variant,
  });
  return `/paper/${slug}?${query}`;
}

/** Presence of explanations on a page is not proof that every passage on it was covered. */
export function explainedPageCount(paragraphs: Paragraph[]): number {
  return new Set(
    paragraphs.flatMap((p) => (p.anchors ?? [{ page: p.page }]).map((anchor) => anchor.page)),
  ).size;
}
