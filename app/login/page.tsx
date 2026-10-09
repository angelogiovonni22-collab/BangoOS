"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

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
    <main className="bos-login-page relative min-h-screen w-full overflow-hidden bg-[#04080d] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-28rem] h-[52rem] w-[52rem] -translate-x-1/2 rounded-full bg-[#0f75d8]/20 blur-[120px]" />
        <div className="absolute bottom-[-20rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[#00a9ff]/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      </div>

      <div className="bos-mobile-login-brand lg:hidden" aria-label="B.O.S. Bango Operating System">
        <div className="mx-auto mb-4 flex items-baseline justify-center gap-0.5" aria-hidden="true">
          <span className="text-5xl font-black tracking-[-0.08em] text-white">B</span>
          <span className="text-5xl font-black tracking-[-0.08em] text-white">.</span>
          <span className="text-5xl font-black tracking-[-0.08em] text-white">O</span>
          <span className="text-5xl font-black tracking-[-0.08em] text-[#1da1ff]">.</span>
          <span className="text-5xl font-black tracking-[-0.08em] text-white">S</span>
          <span className="text-5xl font-black tracking-[-0.08em] text-[#1da1ff]">.</span>
        </div>
        <p className="!mb-5 !text-[10px] font-semibold uppercase tracking-[0.34em] !text-[#7f95aa]">Bango Operating System</p>
        <h1>Welcome Back</h1>
        <p>Securely access your workspace</p>
      </div>

      <div className="relative z-10 mx-auto hidden min-h-screen w-full max-w-[1440px] items-center px-8 py-10 lg:flex xl:px-14">
        <div className="grid w-full grid-cols-[1.08fr_0.92fr] overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#08111a]/88 shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <section className="relative min-h-[700px] overflow-hidden border-r border-white/[0.08] px-14 py-14 xl:px-16 xl:py-16">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(31,157,255,0.18),transparent_34%),linear-gradient(145deg,rgba(12,35,54,0.85),rgba(4,10,16,0.25))]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="mb-14 inline-flex items-center gap-2 rounded-full border border-[#259fff]/25 bg-[#0b2030]/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ecaff]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2fb4ff] shadow-[0_0_12px_rgba(47,180,255,0.95)]" />
                  Powered by B.O.S.
                </div>

                <div className="mb-3 flex items-baseline gap-1" aria-label="B.O.S.">
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.08)]">B</span>
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-white">.</span>
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-white">O</span>
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-[#1ea7ff] drop-shadow-[0_0_18px_rgba(30,167,255,0.7)]">.</span>
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-white">S</span>
                  <span className="text-[94px] font-black leading-none tracking-[-0.09em] text-[#1ea7ff] drop-shadow-[0_0_18px_rgba(30,167,255,0.7)]">.</span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-[#7690a7]">Bango Operating System</p>

                <div className="mt-16 max-w-[560px]">
                  <h1 className="text-5xl font-semibold tracking-[-0.035em] text-white xl:text-[56px]">Welcome back.</h1>
                  <p className="mt-5 max-w-[500px] text-lg leading-8 text-[#91a5b8]">
                    Secure access to your connected projects, crews, financials, field operations, and company intelligence.
                  </p>
                </div>
              </div>

              <div className="grid max-w-[560px] grid-cols-3 gap-3">
                {[
                  ["SECURE", "Workspace access"],
                  ["CONNECTED", "Field + office"],
                  ["LIVE", "Company operations"],
                ].map(([eyebrow, label]) => (
                  <div key={eyebrow} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-4">
                    <p className="text-[9px] font-bold tracking-[0.2em] text-[#2dafff]">{eyebrow}</p>
                    <p className="mt-1 text-xs font-medium text-[#adbdcb]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-h-[700px] items-center justify-center bg-[#070e15]/82 px-12 py-14 xl:px-16">
            <div className="w-full max-w-[470px]">
              <div className="mb-10">
                <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#2eacff]">
                  <span className="h-2 w-2 rounded-full bg-[#2eacff] shadow-[0_0_12px_rgba(46,172,255,0.8)]" />
                  Secure Access
                </div>
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white">{t("auth.loginTitle")}</h2>
                <p className="mt-3 text-base leading-7 text-[#8296a8]">{t("auth.loginDescription")}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#aebfcd]">
                  {t("auth.email")}
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="min-h-14 rounded-xl border-white/[0.1] bg-[#050b11] px-4 text-base text-white shadow-none placeholder:text-[#435564] focus:border-[#2caeff] focus:ring-[#2caeff]/20"
                  />
                </label>

                <label className="block space-y-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#aebfcd]">
                  {t("auth.password")}
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="min-h-14 rounded-xl border-white/[0.1] bg-[#050b11] px-4 text-base text-white shadow-none placeholder:text-[#435564] focus:border-[#2caeff] focus:ring-[#2caeff]/20"
                  />
                </label>

                {routeError ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{routeError}</div> : null}
                {error ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  disabled={loading}
                  className="min-h-14 rounded-xl bg-[linear-gradient(180deg,#1e9cf1,#0c72c4)] text-base font-semibold text-white shadow-[0_10px_30px_rgba(12,114,196,0.28)] hover:brightness-110"
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              <div className="mt-7 flex items-center justify-between border-t border-white/[0.07] pt-6 text-sm text-[#718596]">
                <span>{t("auth.needAccount")}</span>
                <a href="/signup" className="font-semibold text-[#37b5ff] transition hover:text-[#78d1ff]">{t("auth.createOne")}</a>
              </div>

              <p className="mt-10 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[#405260]">
                B.O.S. • Secure company workspace
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="relative z-10 lg:hidden">
        <div className="grid w-full">
          <section className="bos-login-card overflow-hidden">
            <div className="bos-login-card-content space-y-5 p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-2 text-sm font-semibold text-white">
                  {t("auth.email")}
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
                </label>

                <label className="block space-y-2 text-sm font-semibold text-white">
                  {t("auth.password")}
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
                </label>

                {routeError ? <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{routeError}</div> : null}
                {error ? <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

                <Button type="submit" size="lg" fullWidth disabled={loading}>
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>

              <p className="text-sm text-[#7f8d9c]">
                {t("auth.needAccount")} {" "}
                <a href="/signup" className="font-semibold text-[#37b5ff] hover:text-[#78d1ff]">{t("auth.createOne")}</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
