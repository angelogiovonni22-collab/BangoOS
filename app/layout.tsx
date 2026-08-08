import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./legacy-token-aliases.css";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "B.O.S.",
  description: "Bango Operating System construction management workspace",
};

const LOCALE_COOKIE_KEY = "bangoos_i18n_locale";

function isAppLocale(value: string | undefined): value is "en" | "es" {
  return value === "en" || value === "es";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const initialLocale = isAppLocale(cookieLocale) ? cookieLocale : "en";

  return (
    <html lang={initialLocale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
