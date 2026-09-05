import { themeCss, THEME_INIT_SCRIPT } from "@/theme/tokens.js";
import { ThemeProvider } from "@/theme/carbon.jsx";
import { AuthProvider } from "@/lib/auth/AuthProvider.jsx";
import "./globals.css";

export const metadata = {
  title: { default: "Forge — compiler, systems, HFT and quant preparation", template: "%s · Forge" },
  description:
    "A practice system for engineers targeting compiler, systems, high-frequency-trading and quant roles: timed problems with staged hints, runnable labs, long-form guides and spaced repetition.",
  applicationName: "Forge",
  openGraph: { title: "Forge", description: "Practice system for compiler, systems, HFT and quant engineers.", type: "website" },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tokens are server-rendered, so there is no flash and no style injection. */}
        <style id="forge-carbon" dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Runs before paint so a saved theme choice is honoured with no flicker. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
