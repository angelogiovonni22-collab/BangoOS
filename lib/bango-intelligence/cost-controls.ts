/**
 * Cost controls — central model configuration and request limits.
 *
 * Change the model name or limits here; do not scatter config across files.
 */

export const BANGO_AI_CONFIG = {
  /** Model used for superintendent narration */
  model: "gpt-4o-mini",

  /** Low temperature for factual, consistent output */
  temperature: 0.3,

  /** Maximum tokens in the model response */
  maxOutputTokens: 1500,

  /** Hard cap on grounding context characters before it is sent to the model */
  maxInputChars: 8_000,

  /** Request timeout in milliseconds */
  timeoutMs: 25_000,

  /** Maximum retries on transient failures (0 = one attempt only) */
  maxRetries: 0,
} as const;

/**
 * Returns true when the grounding context exceeds the allowed input size.
 */
export function isInputTooLarge(groundingText: string): boolean {
  return groundingText.length > BANGO_AI_CONFIG.maxInputChars;
}
