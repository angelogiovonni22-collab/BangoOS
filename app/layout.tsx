import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./legacy-token-aliases.css";
import "./app-content-surface.css";
import "./visual-theme.css";
import "./theme-gallery.css";
import "./theme-gallery-hardening.css";
import "./dark-theme-hardening.css";
import "./future-2030.css";
import "./future-2030-hardening.css";
import "./sidebar-blue-chrome.css";
import "./visual-consistency.css";
import "./digital-command-hardening.css";
import "./top-command-layout.css";
import "./mobile-reference.css";
import "./mobile-login.css";
import "./mobile-reliability.css";
import "./sidebar-uniform-background.css";
import { BosStartupIntro } from "@/components/startup/BosStartupIntro";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "B.O.S.",
  description: "Bango Operating System construction management workspace",
  applicationName: "B.O.S.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "B.O.S." },
  icons: {
    icon: [
      { url: "/api/app-icon-v3/192", sizes: "192x192", type: "image/png" },
      { url: "/api/app-icon-v3/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/app-icon-v3/180", sizes: "180x180", type: "image/png" }],
    shortcut: ["/api/app-icon-v3/192"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

const LOCALE_COOKIE_KEY = "bangoos_i18n_locale";
function isAppLocale(value: string | undefined): value is "en" | "es" { return value === "en" || value === "es"; }

const themeBootstrapScript = `(() => {
  try {
    const allowed = new Set(["light","dark","executive","blueprint","emerald","graphite","high-contrast","digital-command","future-2030"]);
    const neonAllowed = new Set(["cyan","blue","red","green","white","orange","yellow","purple"]);
    const stored = localStorage.getItem("bangoos-theme");
    const storedNeonAccent = localStorage.getItem("bangoos-neon-accent");
    const theme = allowed.has(stored) ? stored : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const neonAccent = neonAllowed.has(storedNeonAccent) ? storedNeonAccent : "cyan";
    const dark = theme === "dark" || theme === "digital-command" || theme === "future-2030";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.neonAccent = neonAccent;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";

    const storedLayout = localStorage.getItem("bangoos-layout");
    document.documentElement.dataset.layout = storedLayout === "top-command" ? "top-command" : "classic-sidebar";
  } catch {}
})();`;

const startupPrepaintCss = `
html.bos-startup-prepaint,
html.bos-startup-prepaint body {
  margin: 0;
  min-height: 100%;
  background: #000 !important;
}
`;

const appleStartupImages = [
  { width: 320, height: 568, ratio: 2, fileWidth: 640, fileHeight: 1136 },
  { width: 375, height: 667, ratio: 2, fileWidth: 750, fileHeight: 1334 },
  { width: 414, height: 736, ratio: 3, fileWidth: 1242, fileHeight: 2208 },
  { width: 375, height: 812, ratio: 3, fileWidth: 1125, fileHeight: 2436 },
  { width: 414, height: 896, ratio: 2, fileWidth: 828, fileHeight: 1792 },
  { width: 414, height: 896, ratio: 3, fileWidth: 1242, fileHeight: 2688 },
  { width: 390, height: 844, ratio: 3, fileWidth: 1170, fileHeight: 2532 },
  { width: 428, height: 926, ratio: 3, fileWidth: 1284, fileHeight: 2778 },
  { width: 393, height: 852, ratio: 3, fileWidth: 1179, fileHeight: 2556 },
  { width: 430, height: 932, ratio: 3, fileWidth: 1290, fileHeight: 2796 },
] as const;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const initialLocale = isAppLocale(cookieLocale) ? cookieLocale : "en";

  return (
    <html lang={initialLocale} className={`${inter.variable} h-full antialiased bos-startup-prepaint`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: startupPrepaintCss }} />
        {appleStartupImages.map((image) => (
          <link
            key={`${image.fileWidth}x${image.fileHeight}`}
            rel="apple-touch-startup-image"
            href={`/api/app-splash/${image.fileWidth}/${image.fileHeight}`}
            media={`(device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`}
          />
        ))}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <BosStartupIntro />
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
