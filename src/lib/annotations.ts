import { useCallback, useEffect, useState } from "react";
import type { Annotation } from "../types";

function storageKey(slug: string) {
  return `paper-reader:annotations:${slug}`;
}

function load(slug: string): Annotation[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as Annotation[]) : [];
  } catch {
    return [];
  }
}

function persist(slug: string, annotations: Annotation[]) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(annotations));
  } catch {
    // localStorage unavailable (private browsing, quota, ...) — annotations just won't survive a reload.
  }
}

export function useAnnotations(slug: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>(() => load(slug));

  useEffect(() => {
    setAnnotations(load(slug));
  }, [slug]);

  const addAnnotation = useCallback(
    (annotation: Annotation) => {
      setAnnotations((prev) => {
        const next = [...prev, annotation];
        persist(slug, next);
        return next;
      });
    },
    [slug],
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a));
        persist(slug, next);
        return next;
      });
    },
    [slug],
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persist(slug, next);
        return next;
      });
    },
    [slug],
  );

  return { annotations, addAnnotation, updateAnnotation, deleteAnnotation };
}
