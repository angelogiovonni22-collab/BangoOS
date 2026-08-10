import { normalizeIntentInput, parseEntityHint, parseScheduleReadPhrase } from "@/lib/orion/intent-engine";

const EXPLICIT_BOS_ACTION = /\b(open|show|go\s+to|take\s+me\s+to|navigate|find|search|lookup|create|new|add|make|duplicate|update|edit|assign|complete|finish|archive|restore|send|record|generate|convert|start|begin|pause|stop|schedule|reschedule|approve|reject|issue|submit)\b/i;
const BOS_DOMAIN = /\b(customer|client|project|job|estimate|quote|invoice|bill|employee|crew|task|inspection|permit|daily\s+report|change\s+order|schedule|calendar|timeline|dashboard|operations|vendor|material|equipment|payment|deposit)\b/i;
const BOS_READ_QUESTION = /\b(what|which|who|when|where|how)\b.*\b(customer|client|project|job|estimate|quote|invoice|employee|crew|task|inspection|permit|daily\s+report|change\s+order|schedule|calendar|timeline|dashboard|operations|vendor|material|equipment|payment|deposit)\b/i;
const CONVERSATION_OPENERS = /^(hi|hello|hey|good\s+(morning|afternoon|evening)|thanks|thank\s+you|can\s+you|could\s+you|would\s+you|are\s+you|do\s+you|did\s+you|will\s+you|how\s+are\s+you|who\s+are\s+you|what\s+are\s+you|tell\s+me\s+about\s+yourself)\b/i;

export function hasClearBosVoiceIntent(input: string) {
  const normalized = normalizeIntentInput(input).trim();
  if (!normalized) return false;

  if (parseScheduleReadPhrase(normalized)) return true;
  if (EXPLICIT_BOS_ACTION.test(normalized) && BOS_DOMAIN.test(normalized)) return true;
  if (BOS_READ_QUESTION.test(normalized)) return true;
  if (parseEntityHint(normalized) && /\b(status|health|details|information|info|balance|total|due|active|late|overdue|today|tomorrow|this\s+week)\b/i.test(normalized)) return true;

  return false;
}

export function shouldPreferOrionConversation(input: string) {
  const normalized = normalizeIntentInput(input).trim();
  if (!normalized) return false;
  if (hasClearBosVoiceIntent(normalized)) return false;

  if (CONVERSATION_OPENERS.test(normalized)) return true;
  if (/\?$/.test(normalized)) return true;
  if (/^(what|why|how|when|where|who)\b/i.test(normalized) && !BOS_DOMAIN.test(normalized)) return true;

  return !EXPLICIT_BOS_ACTION.test(normalized) && !BOS_DOMAIN.test(normalized);
}
