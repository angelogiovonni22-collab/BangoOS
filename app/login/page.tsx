"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
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

    if (!rawError) {
      return null;
    }

    if (rawError === "missing-confirmation-data") {
      return t("auth.missingConfirmationData");
    }

    if (rawError === "supabase-not-configured") {
      return t("auth.supabaseUnavailable");
    }

    return decodeURIComponent(rawError);
  }, [searchParams, t]);

  const nextPath = useMemo(() => {
    const rawNext = searchParams.get("next");

    if (!rawNext || !rawNext.startsWith("/")) {
      return "/dashboard";
    }

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || t("auth.defaultLoginError"));
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden rounded-[var(--radius-3xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-8 shadow-[var(--shadow-large)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand-700)]">B.O.S.</p>
            <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">Bango Operating System</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("auth.loginTitle")}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[var(--color-text-secondary)]">{t("auth.loginDescription")}</p>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-[var(--color-text-secondary)]">
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Enterprise-grade construction workflows</p>
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Secure company-scoped workspace access</p>
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Fast entry to projects, crews, and reporting</p>
          </div>
        </section>

        <Card as="section" variant="elevated" className="overflow-hidden">
          <CardHeader className="bg-[var(--color-surface-subtle)]/40 px-6 py-6">
            <CardTitle className="text-2xl">{t("auth.loginTitle")}</CardTitle>
            <CardDescription>{t("auth.loginDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {t("auth.email")}
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {t("auth.password")}
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              {routeError ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
                  {routeError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
                  {error}
                </div>
              ) : null}

              <Button type="submit" size="lg" fullWidth disabled={loading}>
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </form>

            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("auth.needAccount")} {" "}
              <a href="/signup" className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                {t("auth.createOne")}
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
