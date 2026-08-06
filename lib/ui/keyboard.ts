function hasEditableRole(element: Element) {
  const role = (element.getAttribute("role") || "").toLowerCase();
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

const MODIFIER_ONLY_KEYS = new Set([
  "alt",
  "altgraph",
  "capslock",
  "control",
  "fn",
  "fnlock",
  "hyper",
  "meta",
  "numlock",
  "os",
  "scrolllock",
  "shift",
  "super",
  "symbol",
  "symbollock",
]);

function toElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function editableFromPath(path: EventTarget[]) {
  for (const entry of path) {
    const element = toElement(entry);
    if (element && isEditableKeyboardTarget(element)) {
      return true;
    }
  }

  return false;
}

function isModifierOnlyKey(event: KeyboardEvent) {
  return MODIFIER_ONLY_KEYS.has(event.key.toLowerCase());
}

function isImeComposing(event: KeyboardEvent) {
  const nativeEvent = event as KeyboardEvent & { keyCode?: number; which?: number };
  return event.isComposing || nativeEvent.keyCode === 229 || nativeEvent.which === 229;
}

export function isEditableKeyboardTarget(target: EventTarget | null) {
  const element = toElement(target);
  if (!element) {
    return false;
  }

  const htmlElement = element as HTMLElement;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }

  if (htmlElement.isContentEditable) {
    return true;
  }

  if (hasEditableRole(element)) {
    return true;
  }

  const editableAncestor = element.closest("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='searchbox'], [role='combobox']");
  return Boolean(editableAncestor);
}

export function shouldIgnoreGlobalShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || isImeComposing(event) || isModifierOnlyKey(event)) {
    return true;
  }

  if (isEditableKeyboardTarget(event.target)) {
    return true;
  }

  if (typeof event.composedPath === "function") {
    return editableFromPath(event.composedPath());
  }

  return false;
}
