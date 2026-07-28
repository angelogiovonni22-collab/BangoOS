export type SupabaseEnv = {
  url: string | null;
  publishableKey: string | null;
  publishableKeySource: "publishable" | "anon" | "none";
  hasUrl: boolean;
  hasPublishableKey: boolean;
  hasAnonKey: boolean;
};

function normalizeEnvValue(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const anonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const selectedKey = publishableKey || anonKey;
  const publishableKeySource: SupabaseEnv["publishableKeySource"] = publishableKey
    ? "publishable"
    : anonKey
      ? "anon"
      : "none";

  return {
    url,
    publishableKey: selectedKey,
    publishableKeySource,
    hasUrl: Boolean(url),
    hasPublishableKey: Boolean(publishableKey),
    hasAnonKey: Boolean(anonKey),
  };
}