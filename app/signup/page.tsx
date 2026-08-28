"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

function normalizeSignupError(error: unknown, fallback: string, accountAlreadyExists: string) {
  let message = "";

  if (typeof error === "string") {
    message = error.trim();
  } else if (error && typeof error === "object" && "message" in error) {
    const rawMessage = (error as { message?: unknown }).message;
    message = typeof rawMessage === "string" ? rawMessage.trim() : "";
  }

  if (!message || message === "{}" || message === "[object Object]") {
    return fallback;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("already registered")
    || normalized.includes("user already exists")
    || normalized.includes("already been registered")
  ) {
    return accountAlreadyExists;
  }

  return message;
}

export default function SignupPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();

    if (!supabase) {
      setError(t("auth.supabaseNotConfigured"));
      setLoading(false);
      return;
    }

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/confirm` : undefined;

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });

      if (signUpError) {
        setError(normalizeSignupError(
          signUpError,
          t("auth.defaultSignupError"),
          t("auth.accountAlreadyExists"),
        ));
        return;
      }

      if (data.user && !data.session) {
        setMessage(t("auth.checkInbox"));
      } else {
        setMessage(t("auth.accountCreated"));
      }
    } catch (signUpError) {
      setError(normalizeSignupError(
        signUpError,
        t("auth.defaultSignupError"),
        t("auth.accountAlreadyExists"),
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card as="section" variant="elevated" className="overflow-hidden">
          <CardHeader className="bg-[var(--color-surface-subtle)]/40 px-6 py-6">
            <CardTitle className="text-2xl">{t("auth.signupTitle")}</CardTitle>
            <CardDescription>{t("auth.signupDescription")}</CardDescription>
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

              {error ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]" role="alert">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-success-50)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]" role="status">
                  {message}
                </div>
              ) : null}

              <Button type="submit" size="lg" fullWidth disabled={loading}>
                {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
              </Button>
            </form>

            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("auth.alreadyAccount")} {" "}
              <a href="/login" className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                {t("auth.signIn")}
              </a>
            </p>
          </CardContent>
        </Card>

        <section className="hidden rounded-[var(--radius-3xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-8 shadow-[var(--shadow-large)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand-700)]">B.O.S.</p>
            <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">Bango Operating System</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("auth.signupTitle")}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[var(--color-text-secondary)]">{t("auth.signupDescription")}</p>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-[var(--color-text-secondary)]">
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Create a secure workspace in minutes</p>
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Keep every company-scoped record organized</p>
            <p className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">Move directly into onboarding after confirmation</p>
          </div>
        </section>
      </div>
    </main>
  );
}
