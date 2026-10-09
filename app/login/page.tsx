"use client";

import Image from "next/image";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

const BOS_LOGO_SRC = "/branding/bos-operating-system-logo.png";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const routeError = useMemo(() => {
    const rawError = searchParams.get("error");

    if (!rawError) return null;
    if (rawError === "missing-confirmation-data") return t("auth.missingConfirmationData");
    if (rawError === "supabase-not-configured") return t("auth.supabaseUnavailable");
    if (rawError === "confirmation-failed") return t("auth.defaultLoginError");
    return t("auth.defaultLoginError");
  }, [searchParams, t]);

  const nextPath = useMemo(() => {
    const rawNext = searchParams.get("next");
    if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) return "/dashboard";
    return rawNext;
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError(t("auth.supabaseNotConfigured"));
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(t("auth.defaultLoginError"));
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <main
      className="bos-login-page min-h-screen w-full bg-[#020b17] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10"
      style={{ colorScheme: "dark" }}
      data-login-theme="locked-dark"
    >
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1530px] gap-7 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex min-h-[760px] flex-col rounded-[32px] border border-[#214d7b] bg-[#061529] px-7 py-8 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:px-10 lg:px-11 lg:py-10">
          <div className="flex flex-1 flex-col">
            <div className="flex justify-center lg:justify-start">
              <Image
                src={BOS_LOGO_SRC}
                alt="B.O.S. Bango Operating System"
                width={720}
                height={672}
                priority
                className="h-auto w-[360px] max-w-full object-contain sm:w-[390px] lg:w-[420px]"
              />
            </div>

            <div className="mt-2 lg:mt-5">
              <h1 className="text-[42px] font-bold leading-tight tracking-[-0.03em] text-white sm:text-[48px]">{t("auth.loginTitle")}</h1>
              <p className="mt-6 text-[18px] leading-8 text-[#b9d3ee] sm:text-[20px]">{t("auth.loginDescription")}</p>
            </div>

            <div className="mt-auto grid gap-4 pt-10 text-[16px] text-[#c3dcf4] sm:text-[18px]">
              <div className="rounded-[20px] border border-[#1f507f] bg-[#0c2a4c] px-5 py-4">Enterprise-grade construction workflows</div>
              <div className="rounded-[20px] border border-[#1f507f] bg-[#0c2a4c] px-5 py-4">Secure company-scoped workspace access</div>
              <div className="rounded-[20px] border border-[#1f507f] bg-[#0c2a4c] px-5 py-4">Fast entry to projects, crews, and reporting</div>
            </div>
          </div>
        </section>

        <section className="min-h-[760px] overflow-hidden rounded-[32px] border border-[#2a5b8f] bg-[#0b2343] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-[#2b5279] px-7 py-7 sm:px-8">
            <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">{t("auth.loginTitle")}</h2>
            <p className="mt-2 text-[18px] text-[#bdd7ef]">{t("auth.loginDescription")}</p>
          </div>

          <div className="px-7 py-7 sm:px-8 sm:py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-[16px] font-bold text-white">{t("auth.email")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="min-h-[58px] w-full rounded-[17px] border border-[#416d9e] bg-[#263f63] px-5 text-[18px] text-white outline-none transition placeholder:text-[#9bb0c7] focus:border-[#4ea8ff] focus:ring-2 focus:ring-[#1f8fff]/25"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[16px] font-bold text-white">{t("auth.password")}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="min-h-[58px] w-full rounded-[17px] border border-[#416d9e] bg-[#263f63] px-5 text-[18px] text-white outline-none transition placeholder:text-[#9bb0c7] focus:border-[#4ea8ff] focus:ring-2 focus:ring-[#1f8fff]/25"
                />
              </label>

              {routeError ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{routeError}</div> : null}
              {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

              <button
                type="submit"
                disabled={loading}
                className="min-h-[58px] w-full rounded-[17px] bg-[linear-gradient(180deg,#3d91ff,#1f73ea)] px-5 text-[17px] font-bold text-white shadow-[0_8px_20px_rgba(31,115,234,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </button>
            </form>

            <p className="mt-7 text-[16px] text-[#c3d7ec] sm:text-[17px]">
              {t("auth.needAccount")} {" "}
              <a href="/signup" className="font-semibold text-[#1677ff] hover:text-[#4b9cff]">{t("auth.createOne")}</a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
