"use client";
/* React bindings for the Carbon tokens. The tokens themselves live in
   tokens.js with no "use client", so the server layout can render the
   stylesheet into <head>. Everything is re-exported here so callers keep
   importing one module. */
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { THEME_STORAGE_KEY } from "./tokens.js";

/* The DOM attribute is the single source of truth; React subscribes to it.
   useSyncExternalStore lets the server snapshot ("dark") differ from the client
   snapshot without a hydration mismatch — React re-renders after hydrating. */
const themeListeners = new Set();
const themeStore = {
  subscribe(l) { themeListeners.add(l); return () => themeListeners.delete(l); },
  get: () => (typeof document === "undefined" ? "dark" : document.documentElement.getAttribute("data-theme") || "dark"),
  server: () => "dark",
  set(mode) {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* private mode */ }
    themeListeners.forEach((l) => l());
  },
};

const ThemeCtx = createContext({ mode: "dark", toggle: () => {}, setMode: () => {} });
export function ThemeProvider({ children }) {
  const mode = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.server);
  const setMode = useCallback((m) => themeStore.set(m), []);
  const toggle = useCallback(() => themeStore.set(themeStore.get() === "dark" ? "light" : "dark"), []);
  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
export const useSyntaxTheme = () => (useTheme().mode === "dark" ? vscDarkPlus : oneLight);

export * from "./tokens.js";
