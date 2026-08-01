/**
 * Bango Intelligence Core — shared types.
 *
 * These types are shared between the server-side API route, the AI provider
 * layer, and the UI integration. No browser-side OpenAI calls. No secrets.
 */

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export const SUPPORTED_REQUEST_TYPES = [
  "narrate_briefing",
  "explain_health",
  "explain_risk",
] as const;

export type BangoAIRequestType = (typeof SUPPORTED_REQUEST_TYPES)[number];

export type BangoAINarrateRequest = {
  projectId: string;
  requestType: BangoAIRequestType;
  /** BCP-47 locale tag, e.g. "en-US" or "es-ES" */
  locale: string;
};

// ---------------------------------------------------------------------------
// Structured AI response — the shape the model must return as JSON
// ---------------------------------------------------------------------------

export type NarratedFocusItem = {
  title: string;
  explanation: string;
  priority: "critical" | "high" | "medium" | "low" | "info";
  source_ids: string[];
};

export type NarratedRisk = {
  title: string;
  explanation: string;
  severity: "critical" | "high" | "medium" | "low";
  source_ids: string[];
};

export type NarratedAction = {
  title: string;
  explanation: string;
  priority: "critical" | "high" | "medium" | "low" | "info";
  source_ids: string[];
  requires_approval: boolean;
};

export type NarratedBriefing = {
  headline: string;
  executive_summary: string;
  today_focus: NarratedFocusItem[];
  risks: NarratedRisk[];
  recommended_actions: NarratedAction[];
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

// ---------------------------------------------------------------------------
// API response envelope (returned from the Next.js route handler to the UI)
// ---------------------------------------------------------------------------

export type BangoAISuccessResponse = {
  ok: true;
  narration: NarratedBriefing;
  generatedAt: string;
  model: string;
  /** True when the AI narration is shown instead of the deterministic version */
  isAiNarration: true;
};

export type BangoAIFallbackResponse = {
  ok: true;
  narration: null;
  fallback: true;
  reason: string;
  isAiNarration: false;
};

export type BangoAIErrorResponse = {
  ok: false;
  error: string;
  isAiNarration: false;
};

export type BangoAIResponse =
  | BangoAISuccessResponse
  | BangoAIFallbackResponse
  | BangoAIErrorResponse;

// ---------------------------------------------------------------------------
// Internal provider types
// ---------------------------------------------------------------------------

export type AIProviderInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  /** BCP-47 locale tag forwarded to the model for language */
  locale: string;
  requestId: string;
};

export type AIProviderOutput = {
  rawText: string;
  tokensUsed: number | null;
  model: string;
  latencyMs: number;
};

export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  complete(input: AIProviderInput): Promise<AIProviderOutput>;
}
