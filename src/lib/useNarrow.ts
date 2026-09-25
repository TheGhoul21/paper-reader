import { useEffect, useState } from "react";

// Matches the phone/tablet-portrait breakpoint in index.css.
const NARROW_QUERY = "(max-width: 899px)";

/** True on narrow screens, where the reader stacks the comments under the PDF as a bottom sheet. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return narrow;
}
