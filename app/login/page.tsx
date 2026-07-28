"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "2rem", background: "#fff" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", color: "#111827" }}>{t("auth.loginTitle")}</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#6b7280" }}>
          {t("auth.loginDescription")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.35rem", color: "#374151", fontWeight: 600 }}>
            {t("auth.email")}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{ padding: "0.75rem 0.9rem", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem", color: "#374151", fontWeight: 600 }}>
            {t("auth.password")}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ padding: "0.75rem 0.9rem", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          {routeError ? (
            <div style={{ padding: "0.75rem", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
              {routeError}
            </div>
          ) : null}

          {error ? (
            <div style={{ padding: "0.75rem", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.8rem 1rem",
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>

        <p style={{ marginTop: "1rem", color: "#6b7280" }}>
          {t("auth.needAccount")} {" "}
          <a href="/signup" style={{ color: "#2563eb", fontWeight: 600 }}>
            {t("auth.createOne")}
          </a>
        </p>
      </div>
    </main>
  );
}
