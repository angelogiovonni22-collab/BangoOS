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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#050b16" },
  ],
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const initialLocale = isAppLocale(cookieLocale) ? cookieLocale : "en";

  return (
    <html lang={initialLocale} className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
