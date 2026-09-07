import { siteUrl, abs, jsonLd, KEYWORDS, SITE_NAME } from "@/lib/seo.js";
import { themeCss, THEME_INIT_SCRIPT } from "@/theme/tokens.js";
import { ThemeProvider } from "@/theme/carbon.jsx";
import { AuthProvider } from "@/lib/auth/AuthProvider.jsx";
import "./globals.css";

const DESCRIPTION =
  "A practice system for engineers targeting compiler, systems, high-frequency-trading and quant roles: "
  + "timed problems with staged hints, runnable performance labs, long-form guides on LLVM, C++ internals "
  + "and microarchitecture, and spaced repetition.";

/* metadataBase is what makes every relative og:image and canonical resolve to
   an absolute URL — without it Next emits a warning and guesses the origin,
   and crawlers get relative URLs they cannot follow. */
export const metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Forge — compiler, systems and HFT interview preparation", template: "%s · Forge" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  category: "education",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Forge — compiler, systems and HFT interview preparation",
    description: DESCRIPTION,
    url: abs("/"),
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Forge", description: DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

/* Site-level structured data. Declared once in the layout so every page
   inherits it, with page-specific Article/LearningResource nodes added by the
   guide and lab pages themselves. */
const SITE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      url: abs("/"),
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": abs("/#app"),
      name: SITE_NAME,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (web browser)",
      url: abs("/"),
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
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
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(SITE_LD)} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
