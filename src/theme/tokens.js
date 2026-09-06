// ════════════════════════════════════════════════════════════════════
//  CARBON — one ground, one accent, state colors only.
//
//  Rules that keep it coherent:
//   · Exactly ONE hue carries identity (amber). Everything else is a neutral
//     or a state signal (ok / warn / bad / info), never decoration.
//   · Depth comes from surface steps and hairlines, not from shadows and
//     gradients. Shadows exist only for things that float above the page.
//   · Monospace for every number, id, key and label. Sans for prose.
//   · Motion is a token, not an ad-hoc transition. See motion.css.
//
//  Tokens are injected as CSS custom properties so the whole app can be
//  restyled without touching a component, and so light/dark is one attribute.
// ════════════════════════════════════════════════════════════════════

const dark = {
  colorScheme: "dark",
  /* ground → raised */
  bg: "#08080A", bg1: "#0E0E11", bg2: "#141418", bg3: "#1B1B21", bg4: "#232329",
  /* hairlines */
  line: "#23232B", line2: "#32323C", lineHot: "#43434F",
  /* ink */
  text: "#EDEDF0", dim: "#9B9BA6", faint: "#8A8A94", inverse: "#08080A",   /* faint carries nav and captions: keep it >= 4.5:1 */
  /* the one hue */
  accent: "#E8B339", accentHi: "#F5C763", accentLo: "#8A6A20",
  accentBg: "rgba(232,179,57,0.10)", accentBg2: "rgba(232,179,57,0.18)", accentLine: "rgba(232,179,57,0.34)",
  /* state, used only as signal */
  ok: "#4ADE80", okBg: "rgba(74,222,128,0.10)", okLine: "rgba(74,222,128,0.30)",
  warn: "#FBBF24", warnBg: "rgba(251,191,36,0.10)", warnLine: "rgba(251,191,36,0.30)",
  bad: "#F87171", badBg: "rgba(248,113,113,0.10)", badLine: "rgba(248,113,113,0.30)",
  info: "#7DA6F5", infoBg: "rgba(125,166,245,0.10)", infoLine: "rgba(125,166,245,0.30)",
  /* code */
  codeBg: "#0B0B0E", codeLine: "#1D1D24", codeText: "#DADAE2",
  /* float */
  shadow1: "0 1px 2px rgba(0,0,0,.5)",
  shadow2: "0 8px 24px -6px rgba(0,0,0,.65), 0 2px 6px rgba(0,0,0,.4)",
  shadow3: "0 24px 64px -12px rgba(0,0,0,.8), 0 8px 20px rgba(0,0,0,.5)",
  glow: "0 0 0 1px rgba(232,179,57,.28), 0 0 28px -6px rgba(232,179,57,.30)",
  scrim: "rgba(4,4,6,.72)",
  /* scrollbars */
  scrollTrack: "#08080A", scrollThumb: "#26262E", scrollThumbHover: "#3A3A45",
  /* long-form reading */
  mdText: "#D3D3DB", mdRule: "#23232B", mdQuote: "#101014",
};

const light = {
  colorScheme: "light",
  bg: "#FBFBF9", bg1: "#FFFFFF", bg2: "#F6F6F3", bg3: "#EFEFEB", bg4: "#E7E7E2",
  line: "#E3E3DD", line2: "#D2D2CA", lineHot: "#B9B9B0",
  text: "#16161A", dim: "#5E5E68", faint: "#6E6E77", inverse: "#FFFFFF",   /* faint carries nav and captions: keep it >= 4.5:1 */
  accent: "#A9720A", accentHi: "#8A5D06", accentLo: "#D8AB4E",
  accentBg: "rgba(169,114,10,0.08)", accentBg2: "rgba(169,114,10,0.14)", accentLine: "rgba(169,114,10,0.30)",
  ok: "#16794B", okBg: "rgba(22,121,75,0.08)", okLine: "rgba(22,121,75,0.26)",
  warn: "#8A5D06", warnBg: "rgba(138,93,6,0.08)", warnLine: "rgba(138,93,6,0.26)",
  bad: "#B3261E", badBg: "rgba(179,38,30,0.08)", badLine: "rgba(179,38,30,0.26)",
  info: "#2F5FB8", infoBg: "rgba(47,95,184,0.08)", infoLine: "rgba(47,95,184,0.26)",
  codeBg: "#F7F7F4", codeLine: "#E3E3DD", codeText: "#22222A",
  shadow1: "0 1px 2px rgba(20,20,24,.06)",
  shadow2: "0 8px 24px -8px rgba(20,20,24,.14), 0 2px 6px rgba(20,20,24,.06)",
  shadow3: "0 24px 64px -16px rgba(20,20,24,.20), 0 8px 20px rgba(20,20,24,.08)",
  glow: "0 0 0 1px rgba(169,114,10,.30), 0 0 26px -8px rgba(169,114,10,.28)",
  scrim: "rgba(28,28,32,.36)",
  scrollTrack: "#FBFBF9", scrollThumb: "#DCDCD5", scrollThumbHover: "#C2C2B9",
  mdText: "#2A2A33", mdRule: "#E3E3DD", mdQuote: "#F6F6F3",
};

/* Type scale, spacing and motion: the same in both modes. */
const STATIC = {
  /* type */
  "fs-micro": "10.5px", "fs-xs": "11.5px", "fs-caption": "12px", "fs-sm": "13px",
  "fs-base": "14.5px", "fs-md": "15.5px", "fs-lg": "17px", "fs-xl": "20px",
  "fs-2xl": "26px", "fs-3xl": "34px", "fs-4xl": "46px",
  /* rhythm */
  "sp-1": "4px", "sp-2": "8px", "sp-3": "12px", "sp-4": "16px", "sp-5": "24px",
  "sp-6": "32px", "sp-7": "48px", "sp-8": "64px",
  "r-1": "6px", "r-2": "9px", "r-3": "13px", "r-4": "18px", "r-full": "999px",
  /* motion: the whole app's timing vocabulary */
  "ease-out": "cubic-bezier(.16,1,.3,1)",         /* expo-out: the premium settle */
  "ease-in-out": "cubic-bezier(.65,0,.35,1)",
  "ease-spring": "cubic-bezier(.34,1.56,.64,1)",  /* slight overshoot, for confirmations */
  "dur-1": "110ms",   /* micro: hover, press */
  "dur-2": "220ms",   /* standard: reveal, tab change */
  "dur-3": "420ms",   /* entrance: cards, panels */
  "dur-4": "760ms",   /* page: surface transitions */
};

export const FONTS = {
  mono: "'JetBrains Mono','SF Mono','Cascadia Code','Fira Code',ui-monospace,Menlo,Consolas,monospace",
  sans: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
};

const toVars = (obj) => Object.entries(obj).map(([k, v]) => `--tk-${k}:${v};`).join("");
const toStatic = () => Object.entries(STATIC).map(([k, v]) => `--${k}:${v};`).join("");


/* ── server-side rendering ──────────────────────────────────────────────
   The stylesheet is a pure string, so Next renders it into <head> on the
   server: no flash, no client-side style injection, no layout shift. The
   tiny init script below sets data-theme BEFORE first paint, which is the
   only way to honour a saved choice without a flash of the wrong theme. */
export const THEME_STORAGE_KEY = "forge-theme";

export function themeCss() {
  return `:root{${toStatic()}${toVars(dark)}}` +
         `:root[data-theme="light"]{${toVars(light)}}`;
}

export const THEME_INIT_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(m!=="light"&&m!=="dark"){m=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}
document.documentElement.setAttribute("data-theme",m);
document.documentElement.style.colorScheme=m;
}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

/* Every token as a var() reference, so components never hardcode a color. */
export const tk = Object.keys(dark).reduce((a, k) => {
  if (k !== "colorScheme") a[k] = `var(--tk-${k})`;
  return a;
}, { ...FONTS });

/* Translucent tint of any token color. */
export const alpha = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
/* Blend two tokens, e.g. a hover surface. */
export const mix = (a, b, pct) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/* Semantic hue lookup: components name a role ("ok"), never a color. */
export const HUE = {
  accent: { fg: tk.accent, bg: tk.accentBg, bg2: tk.accentBg2, line: tk.accentLine },
  ok:     { fg: tk.ok,     bg: tk.okBg,     bg2: tk.okBg,      line: tk.okLine },
  warn:   { fg: tk.warn,   bg: tk.warnBg,   bg2: tk.warnBg,    line: tk.warnLine },
  bad:    { fg: tk.bad,    bg: tk.badBg,    bg2: tk.badBg,     line: tk.badLine },
  info:   { fg: tk.info,   bg: tk.infoBg,   bg2: tk.infoBg,    line: tk.infoLine },
  neutral:{ fg: tk.dim,    bg: tk.bg2,      bg2: tk.bg3,       line: tk.line },
};
export const hue = (name) => HUE[name] || HUE.neutral;

