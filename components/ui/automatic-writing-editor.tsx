"use client";

import { useEffect } from "react";
import { improveNarrativeText, shouldAutoEditElement } from "@/lib/writing/automatic-editor";

const EDIT_DELAY_MS = 900;

export function AutomaticWritingEditor() {
  useEffect(() => {
    const timers = new WeakMap<HTMLTextAreaElement, number>();
    const applying = new WeakSet<HTMLTextAreaElement>();
    const composing = new WeakSet<HTMLTextAreaElement>();

    const enhance = (element: HTMLTextAreaElement) => {
      element.spellcheck = true;
      element.setAttribute("autocapitalize", "sentences");
      element.setAttribute("autocorrect", "on");
      element.dataset.autoEditor = "active";
    };

    const apply = (element: HTMLTextAreaElement, finalize: boolean) => {
      if (!shouldAutoEditElement(element) || composing.has(element)) return;
      const next = improveNarrativeText(element.value, { finalize });
      if (next === element.value) return;

      const selectionStart = element.selectionStart;
      const selectionEnd = element.selectionEnd;
      const delta = next.length - element.value.length;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      applying.add(element);
      setter?.call(element, next);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: null }));
      if (document.activeElement === element) {
        element.setSelectionRange(Math.max(0, selectionStart + delta), Math.max(0, selectionEnd + delta));
      }
      queueMicrotask(() => applying.delete(element));
    };

    const schedule = (element: HTMLTextAreaElement) => {
      const existing = timers.get(element);
      if (existing) window.clearTimeout(existing);
      timers.set(element, window.setTimeout(() => apply(element, false), EDIT_DELAY_MS));
    };

    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLTextAreaElement && shouldAutoEditElement(event.target)) enhance(event.target);
    };
    const onInput = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement && !applying.has(event.target) && shouldAutoEditElement(event.target)) schedule(event.target);
    };
    const onBlur = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement) || !shouldAutoEditElement(event.target)) return;
      const existing = timers.get(event.target);
      if (existing) window.clearTimeout(existing);
      apply(event.target, true);
    };
    const onCompositionStart = (event: CompositionEvent) => { if (event.target instanceof HTMLTextAreaElement) composing.add(event.target); };
    const onCompositionEnd = (event: CompositionEvent) => { if (event.target instanceof HTMLTextAreaElement) { composing.delete(event.target); schedule(event.target); } };

    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    document.querySelectorAll("textarea").forEach((element) => { if (shouldAutoEditElement(element)) enhance(element); });

    return () => {
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
    };
  }, []);

  return null;
}
