"use client";
/* ══════════════════════════════════════════════════════════════════════════
   COMPATIBILITY SHIM — the old rainbow palette, mapped onto Carbon.

   The 33 legacy Prep modules in App.jsx name ~50 different colors inline
   (tk.violetPale, tk.fuchsia, tk.calloutWarn …). Rewriting 196 Q&A items to
   use semantic hues would take days and risk the content. Instead every old
   token is re-pointed at one of Carbon's six roles, so the legacy screens
   inherit the new palette, the new type scale and light/dark for free, and
   the rainbow collapses to one accent plus state colors.

   New code must import from ./theme/carbon.jsx and use hue names, not these.
   ══════════════════════════════════════════════════════════════════════════ */
import { tk as C, alpha as A, FONTS, ThemeProvider as TP, useTheme as UT, useSyntaxTheme as UST } from "@/theme/carbon.jsx";

export const tk = {
  ...FONTS,
  /* surfaces */
  bg: C.bg, bg2: C.bg1, bg3: C.bg2, bgAlt: C.bg1, heroTint: C.bg2,
  border: C.line, borderLight: C.line2,
  /* ink */
  text: C.text, textDim: C.dim, textBright: C.text,
  /* the one hue: everything that used to be a "primary" color */
  accent: C.accent, accentDim: C.accentBg, blue: C.accent, blueDim: C.accentBg,
  amber: C.accent, amberDim: C.accentBg, amberBright: C.accentHi, yellow: C.accent,
  orange: C.warn, orangeSoft: C.warn, violet: C.accent, violetPale: C.accentHi,
  purple: C.accent, purpleLight: C.accentHi, fuchsia: C.accentHi, pink: C.warn,
  indigo: C.info, blueSoft: C.info, sky: C.info, cyan: C.info, cyanBright: C.info,
  teal: C.info, tealDim: C.info, mint: C.ok,
  /* state stays state */
  green: C.ok, greenBright: C.ok, greenPale: C.ok, emerald: C.ok, emeraldBright: C.ok, lime: C.ok,
  red: C.bad, redDim: C.badBg, redSoft: C.bad, redPale: C.bad, rose: C.bad, roseSoft: C.bad,
  slate: C.faint,
  /* code */
  codeBg: C.codeBg, codeText: C.codeText, codeTitleBg: C.bg1,
  /* callouts */
  calloutInfo: C.infoBg, calloutWarn: C.warnBg, calloutTip: C.okBg,
  calloutDanger: C.badBg, calloutInterview: C.accentBg,
  /* depth */
  shadowSm: C.shadow1, shadowMd: C.shadow2, shadowLg: C.shadow3, glow: C.glow, overlay: C.scrim,
  /* diagrams */
  diagramBg: C.bg1, diagramDot: C.line, nodeBg: C.bg2, connector: C.line2,
  /* markdown */
  mdText: C.mdText, mdH3: C.text, mdLink: C.accent, mdQuoteBg: C.mdQuote,
  mdThBg: C.bg2, mdThText: C.text, mdH1From: C.text, mdH1To: C.text, mdBulletGlow: "none",
  /* scrollbars */
  scrollTrack: C.bg, scrollThumb: C.scrollThumb, scrollThumbHover: C.scrollThumbHover,
};

/* The old alpha() took a 2-digit hex string ("22"); carbon's takes a percent. */
export const alpha = (color, hex) => A(color, Math.round(parseInt(hex, 16) / 2.55));

export const ThemeProvider = TP;
export const useTheme = UT;
export const useSyntaxTheme = UST;

/* The old toggle button; the shell has its own, so this is only for legacy screens. */
export function ThemeToggle() { return null; }
