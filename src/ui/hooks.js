"use client";
// ════════════════════════════════════════════════════════════════════
//  Two hooks the whole app needs and React 19's rules make explicit.
// ════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

/* A clock value that is stable within a render and refreshes on an interval.
   Reading Date.now() during render is impure; this makes the impurity a
   state transition instead, and gives live "elapsed" displays for free. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* React's blessed "adjust state when a prop changes" pattern, for the deep
   links the shell passes down. `target.n` is a fresh timestamp per navigation,
   so this fires once per navigation and never in a loop. */
export function useTargetChange(target, apply) {
  const [seen, setSeen] = useState(null);
  const n = target?.n ?? null;
  if (target && n !== seen) {
    setSeen(n);
    apply(target);
  }
}
