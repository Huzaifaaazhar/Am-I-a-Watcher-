"use client";

import { useEffect, useState } from "react";

/**
 * A media query as state.
 *
 * Starts false on the server and on the first client render so the two agree,
 * then corrects in an effect. Used to decide whether the event rail is a
 * docked column or a bottom sheet: rendering both and hiding one with CSS put
 * two copies of the same form in the document, which duplicated every input
 * id and made "the first matching control" mean the invisible one.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** The breakpoint where the rail docks - Tailwind's `lg`. */
export const DOCKED = "(min-width: 1024px)";
/** Where there is room for the deviation triptych's third column - `xl`. */
export const TRIPTYCH = "(min-width: 1280px)";
