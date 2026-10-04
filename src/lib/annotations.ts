import { useCallback } from "react";
import type { Annotation } from "../types";
import { userDataStore, useUserData } from "./storage.ts";

const EMPTY: Annotation[] = [];

export function useAnnotations(slug: string) {
  const { data } = useUserData();
  const annotations = data.annotations[slug] ?? EMPTY;
  const update = useCallback(
    (fn: (annotations: Annotation[]) => Annotation[]) => {
      userDataStore.update((current) => ({
        ...current,
        annotations: { ...current.annotations, [slug]: fn(current.annotations[slug] ?? []) },
      }));
    },
    [slug],
  );

  const addAnnotation = useCallback(
    (annotation: Annotation) => {
      update((prev) => [...prev, { ...annotation, updatedAt: new Date().toISOString() }]);
    },
    [update],
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      update((prev) =>
        prev.map((a) =>
          a.id === id ? ({ ...a, ...patch, updatedAt: new Date().toISOString() } as Annotation) : a,
        ),
      );
    },
    [update],
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      update((prev) => prev.filter((a) => a.id !== id));
    },
    [update],
  );

  return { annotations, addAnnotation, updateAnnotation, deleteAnnotation };
}
