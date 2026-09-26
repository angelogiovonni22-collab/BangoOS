const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi\b/g, "I"],
  [/\bim\b/gi, "I'm"],
  [/\bdont\b/gi, "don't"],
  [/\bdoesnt\b/gi, "doesn't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bshouldnt\b/gi, "shouldn't"],
  [/\bcouldnt\b/gi, "couldn't"],
  [/\bwouldnt\b/gi, "wouldn't"],
  [/\bwasnt\b/gi, "wasn't"],
  [/\bwerent\b/gi, "weren't"],
  [/\bhasnt\b/gi, "hasn't"],
  [/\bhavent\b/gi, "haven't"],
  [/\bthats\b/gi, "that's"],
  [/\btheres\b/gi, "there's"],
  [/\btheyre\b/gi, "they're"],
  [/\bweve\b/gi, "we've"],
  [/\byoure\b/gi, "you're"],
];

export function improveNarrativeText(input: string, options: { finalize?: boolean } = {}) {
  if (!input || shouldPreserveVerbatim(input)) return input;

  let output = input
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,;:!?])/g, "$1")
    .replace(/([,;:!?])([A-Za-z])/g, "$1 $2")
    .replace(/\.([A-Za-z])/g, ". $1");

  for (const [pattern, replacement] of CONTRACTIONS) output = output.replace(pattern, replacement);

  output = capitalizeSentences(output);

  if (options.finalize) output = finishSentence(output);
  return output;
}

export function shouldAutoEditElement(element: HTMLTextAreaElement) {
  if (element.disabled || element.readOnly) return false;
  if (element.dataset.autoEdit === "off") return false;
  if (element.closest('[data-auto-edit="off"]')) return false;
  return true;
}

const INPUT_ASSISTANCE_EXCLUSIONS = /(?:email|phone|tel|url|website|password|code|sku|vin|serial|postal|zip|state|tax|ein|ssn|account|routing|license[_-]?number|permit[_-]?number|invoice[_-]?number|estimate[_-]?number|project[_-]?number)/i;
const NON_LANGUAGE_AUTOCOMPLETE = new Set(["email", "tel", "url", "username", "current-password", "new-password", "one-time-code"]);

export function shouldEnableNativeInputAssistance(element: HTMLInputElement) {
  if (element.disabled || element.readOnly) return false;
  if (element.dataset.autoEdit === "off" || element.closest('[data-auto-edit="off"]')) return false;

  const type = (element.type || "text").toLowerCase();
  if (type !== "text") return false;

  const autoComplete = (element.autocomplete || "").toLowerCase();
  if (NON_LANGUAGE_AUTOCOMPLETE.has(autoComplete)) return false;

  const semanticName = [element.name, element.id, element.getAttribute("aria-label") || ""].join(" ");
  if (INPUT_ASSISTANCE_EXCLUSIONS.test(semanticName)) return false;

  return true;
}

function capitalizeSentences(value: string) {
  let capitalizeNext = true;
  return Array.from(value).map((character) => {
    if (/[A-Za-z]/.test(character) && capitalizeNext) {
      capitalizeNext = false;
      return character.toUpperCase();
    }
    if (/[.!?\n]/.test(character)) capitalizeNext = true;
    return character;
  }).join("");
}

function finishSentence(value: string) {
  const trailing = value.match(/\s*$/)?.[0] || "";
  const body = value.slice(0, value.length - trailing.length);
  if (!body || /[.!?:;,)\]}]$/.test(body)) return value;
  if (body.split(/\s+/).filter(Boolean).length < 3) return value;
  return body + "." + trailing;
}

function shouldPreserveVerbatim(value: string) {
  return /https?:\/\/|www\.|```|\{[^}]*\}|<\/?[a-z][^>]*>/i.test(value);
}
