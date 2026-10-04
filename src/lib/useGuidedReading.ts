import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { userDataStore, useUserData } from "./storage";
import {
  newGuidedProgress,
  updateGuidedProgress,
  type GuidedReadingAction,
  type GuidedStop,
  type GuidedReadingProgress,
} from "./guidedReading";

// Only for unreadable storage: keep a recoverable draft when switching to the PDF and back.
// Normal sessions always use the shared store; this map never writes to localStorage.
const recoveryDrafts = new Map<string, GuidedReadingProgress>();

/** Owns route transitions, recoverable progress and scroll for the guided journey. */
export function useGuidedReading(slug: string, stops: GuidedStop[], variant: string) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const snapshot = useUserData();
  const saved = snapshot.data.journeys?.[slug];
  const [fallback, setFallback] = useState(
    () => saved ?? recoveryDrafts.get(slug) ?? newGuidedProgress(stops[0].step.id, variant),
  );
  const progress = snapshot.readFailed ? fallback : (saved ?? fallback);
  useEffect(() => {
    const draft = recoveryDrafts.get(slug);
    if (snapshot.readFailed || !draft) return;
    userDataStore.update((data) => {
      const current = data.journeys?.[slug];
      if (current && Date.parse(current.updatedAt) >= Date.parse(draft.updatedAt)) return data;
      return { ...data, journeys: { ...data.journeys, [slug]: draft } };
    });
    recoveryDrafts.delete(slug);
  }, [slug, snapshot.readFailed]);
  const requestedStep =
    params.get("step") ??
    (params.get("view") === "guide"
      ? stops.find((stop) => stop.step.paragraphs.includes(params.get("p") ?? ""))?.step.id
      : null);
  const requestedIndex = stops.findIndex((stop) => stop.step.id === requestedStep);
  const savedIndex = stops.findIndex((stop) => stop.step.id === progress.stepId);
  const index = requestedIndex >= 0 ? requestedIndex : Math.max(0, savedIndex);
  const stage =
    params.get("stage") === "summary"
      ? "summary"
      : params.get("stage") === "read" || requestedStep
        ? "read"
        : "overview";
  const stop = stops[index];
  const phase = stage === "summary" ? "summary" : "reading";
  const validIds = new Set(stops.map((item) => item.step.id));
  const explored = new Set(progress.explored.filter((id) => validIds.has(id)));
  const doubts = new Set(progress.doubts.filter((id) => validIds.has(id)));
  const outdated = [...new Set([...progress.explored, ...progress.doubts, progress.stepId])].filter(
    (id) => !validIds.has(id),
  ).length;

  const commit = useCallback(
    (action: GuidedReadingAction) => {
      const now = new Date().toISOString();
      if (userDataStore.getSnapshot().readFailed) {
        const next = updateGuidedProgress(
          recoveryDrafts.get(slug) ?? newGuidedProgress(stops[0].step.id, variant),
          action,
          now,
        );
        recoveryDrafts.set(slug, next);
        setFallback(next);
        return;
      }
      userDataStore.update((data) => ({
        ...data,
        journeys: {
          ...data.journeys,
          [slug]: updateGuidedProgress(
            data.journeys?.[slug] ?? newGuidedProgress(stops[0].step.id, variant),
            action,
            now,
          ),
        },
      }));
    },
    [slug, stops, variant],
  );
  // Scroll handlers should use current progress without restarting every autosave.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  function changeRoute(
    nextStage: typeof stage,
    stepId: string,
    replace = false,
    paragraphId?: string,
  ) {
    const query = new URLSearchParams(params);
    for (const key of ["p", "view", "prototype", "variant", "from"]) query.delete(key);
    query.set("v", variant);
    if (nextStage === "overview") {
      query.delete("stage");
      query.delete("step");
    } else {
      query.set("stage", nextStage);
      query.set("step", stepId);
    }
    if (paragraphId) {
      query.set("view", "guide");
      query.set("p", paragraphId);
    }
    setParams(query, { replace, state: location.state });
  }
  function openStep(next: number) {
    const destination = stops[next];
    if (!destination) return;
    commit({ type: "open", stepId: destination.step.id, variant, phase: "reading" });
    changeRoute("read", destination.step.id);
  }
  function continueReading(doubt: boolean) {
    const nextStepId = stops[index + 1]?.step.id ?? null;
    commit({ type: "continue", stepId: stop.step.id, nextStepId, doubt, variant });
    changeRoute(nextStepId ? "read" : "summary", nextStepId ?? stop.step.id);
  }
  function showSummary() {
    commit({ type: "open", stepId: stop.step.id, variant, phase: "summary" });
    changeRoute("summary", stop.step.id);
  }
  function resume() {
    changeRoute(
      progress.phase === "summary" ? "summary" : "read",
      stops[Math.max(0, savedIndex)].step.id,
    );
  }
  function goToParagraph(id: string) {
    const destination = stops.findIndex((item) => item.step.paragraphs.includes(id));
    if (destination >= 0) {
      commit({ type: "open", stepId: stops[destination].step.id, variant, phase: "reading" });
      changeRoute("read", stops[destination].step.id, false, id);
    }
  }
  function sourceUrl(paragraphId?: string) {
    const query = new URLSearchParams({
      view: "pdf",
      v: variant,
      from: "guide",
      stage: stage === "summary" ? "summary" : "read",
      step: stop.step.id,
    });
    if (paragraphId) query.set("p", paragraphId);
    return `/paper/${slug}?${query}`;
  }
  function rememberSourceReturn() {
    commit({ type: "scroll", stepId: stop.step.id, phase, y: window.scrollY });
  }

  useEffect(() => {
    if (stage === "overview") return;
    const current = userDataStore.getSnapshot().data.journeys?.[slug];
    if (!current || current.stepId !== stop.step.id || current.phase !== phase)
      commitRef.current({ type: "open", stepId: stop.step.id, phase, variant });
    else commitRef.current({ type: "variant", variant });
  }, [slug, stage, stop.step.id, phase, variant]);

  const paragraphId = params.get("view") === "guide" ? params.get("p") : null;
  useLayoutEffect(() => {
    const current = userDataStore.getSnapshot().data.journeys?.[slug];
    const y =
      stage !== "overview" && current?.stepId === stop.step.id && current.phase === phase
        ? current.scrollY
        : 0;
    // Focus before paint: a deferred frame can steal focus from a glossary opened immediately.
    const passage = paragraphId ? document.getElementById(`guided-p-${paragraphId}`) : null;
    if (passage) {
      for (let parent = passage.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      passage.focus({ preventScroll: true });
      passage.scrollIntoView({ block: "start", behavior: "instant" });
    } else {
      document.querySelector<HTMLElement>("[data-guided-heading]")?.focus({ preventScroll: true });
      window.scrollTo({ top: y, behavior: "instant" });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    function saveScroll() {
      if (stage === "overview") return;
      clearTimeout(timer);
      timer = setTimeout(
        () => commitRef.current({ type: "scroll", stepId: stop.step.id, phase, y: window.scrollY }),
        200,
      );
    }
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", saveScroll);
    };
  }, [slug, stage, stop.step.id, phase, paragraphId]);

  return {
    progress,
    hasProgress: !!saved || (!!snapshot.readFailed && recoveryDrafts.has(slug)),
    unreadableStorage: !!snapshot.readFailed,
    explored,
    doubts,
    outdated,
    index,
    stage,
    stop,
    invalidStep: !!requestedStep && requestedIndex < 0,
    openStep,
    continueReading,
    showSummary,
    resume,
    goToParagraph,
    sourceUrl,
    rememberSourceReturn,
    showOverview: () => changeRoute("overview", stop.step.id),
    reflect: (text: string) => commit({ type: "reflect", text }),
  };
}
