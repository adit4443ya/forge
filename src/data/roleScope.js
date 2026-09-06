/* ════════════════════════════════════════════════════════════════════════════
   ROLE SCOPE — one definition of "does this belong to my role", used by every
   surface so the switch in the top bar means the same thing everywhere.

   Deliberately a SORT and a HIGHLIGHT, not a filter that hides things. A
   compiler candidate still does the whole coding bar; what changes is what
   comes first and what is marked as on the critical path. Hiding two thirds of
   the bank because someone picked a role would be worse advice than the
   product not having roles at all.
   ════════════════════════════════════════════════════════════════════════════ */

/* Which rapid-fire and estimation decks a role should open with. */
export const ROLE_DECKS = {
  compiler: { rapid: ["compiler", "arch", "cpp"], est: ["compute", "systems"] },
  systems:  { rapid: ["sys", "arch", "cpp"],      est: ["systems", "compute"] },
  hft:      { rapid: ["cpp", "sys", "hft", "prob"], est: ["market", "systems"] },
};

/** The problem sections this role's competencies name. */
export function roleSections(role) {
  return new Set((role?.competencies || []).flatMap((c) => c.sections || []));
}

/** The lab-id prefixes this role's competencies name. */
export function roleLabPrefixes(role) {
  return (role?.competencies || []).flatMap((c) => c.labs || []);
}

export function isRoleLab(labId, role) {
  return roleLabPrefixes(role).some((p) => labId === p || labId.startsWith(p));
}

/** Guides this role's competencies point at, in the order they are referenced. */
export function roleGuides(role) {
  const out = [];
  for (const c of role?.competencies || []) for (const g of c.guides || []) if (!out.includes(g)) out.push(g);
  return out;
}

/* Sort problems so the role's sections come first, each group keeping its own
   order. Stable, so the underlying curriculum order is preserved within a tier. */
export function sortForRole(problems, role) {
  const secs = roleSections(role);
  return [...problems].sort((a, b) => (secs.has(b.section) ? 1 : 0) - (secs.has(a.section) ? 1 : 0));
}

export const decksFor = (roleId, kind) => ROLE_DECKS[roleId]?.[kind] || [];
