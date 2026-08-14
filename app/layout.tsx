import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./legacy-token-aliases.css";
import "./app-content-surface.css";
import "./visual-theme.css";
import "./theme-gallery.css";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "B.O.S.",
  description: "Bango Operating System construction management workspace",
  applicationName: "B.O.S.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "B.O.S." },
  icons: { icon: "/bos-app-icon.svg" },
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
    const allowed = new Set(["light","dark","executive","blueprint","emerald","graphite","high-contrast","digital-command"]);
    const stored = localStorage.getItem("bangoos-theme");
    const theme = allowed.has(stored) ? stored : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const dark = theme === "dark" || theme === "digital-command";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
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
