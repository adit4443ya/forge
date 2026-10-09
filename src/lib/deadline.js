/* Bound a promise that must not be allowed to hang.

   The case this exists for: an await on a network call inside middleware. A
   slow or unreachable host does not reject, it stalls, so try/catch gives no
   protection — the request blocks until the platform kills it and the visitor
   gets a 504 instead of the page. Where the awaited work is an optimisation
   rather than a requirement, a missed deadline should cost nothing. */
export function withDeadline(promise, ms) {
  let timer;
  const expired = new Promise((resolve) => {
    /* Resolves rather than rejects: expiry is a normal outcome here, not an
       error, and callers should not need a catch to handle it. */
    timer = setTimeout(() => resolve(DEADLINE_EXPIRED), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

/** What withDeadline resolves to when the deadline wins. */
export const DEADLINE_EXPIRED = Symbol.for("forge.deadline.expired");
