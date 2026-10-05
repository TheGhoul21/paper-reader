import { useEffect, useState } from "react";

/** Shared user-started playback; manual navigation always pauses. */
export function useFigurePlayback(total: number, interval = 1000) {
  const [step, setStep] = useState(0);
  const [previousStep, setPreviousStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = Math.min(step + 1, total);
      setPreviousStep(step);
      setStep(next);
      if (next === total) setPlaying(false);
    }, interval);
    return () => window.clearTimeout(timer);
  }, [playing, step, total, interval]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  function goTo(next: number) {
    setPlaying(false);
    setPreviousStep(step);
    setStep(Math.max(0, Math.min(next, total)));
  }
  function toggle() {
    if (step === total) {
      setPreviousStep(step);
      setStep(0);
    }
    setPlaying((value) => !value);
  }
  return { step, previousStep, playing, goTo, toggle };
}
