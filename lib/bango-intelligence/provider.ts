/**
 * Provider abstraction — re-exports the provider interface and factory.
 *
 * Swap the underlying provider without changing callers.
 */

export type { AIProvider, AIProviderInput, AIProviderOutput } from "./types";
export { OpenAIProvider, getSuperintendentProvider } from "./openai-provider";
