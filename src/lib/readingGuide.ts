import type { ReadingSection, ReadingStep } from "../types";

export interface ReadingContext {
  section: ReadingSection;
  step: ReadingStep;
  stepIndex: number;
}

/** Resolve context from paragraph ids, never from section-name guessing or badge numbers. */
export function indexReadingGuide(sections: ReadingSection[] = []): Map<string, ReadingContext> {
  const contexts = new Map<string, ReadingContext>();
  for (const section of sections) {
    section.steps.forEach((step, stepIndex) => {
      for (const id of step.paragraphs) contexts.set(id, { section, step, stepIndex });
    });
  }
  return contexts;
}
