// Carries out one step on the page for the user: clicking, typing, hovering,
// pressing a key or scrolling. The request comes from a model that has read
// untrusted page text, so every check happens here, on the real element. Anything
// that could spend money, delete something or send a password is left for the
// user to do themselves.
//
// These are scripted events, not real input from the operating system: a site can
// tell the difference, CSS :hover does not react, and the browser's own key
// behaviour (Tab moving focus, arrows moving a caret) has to be imitated here.

import { debug } from "../debug";
import type { ActResult, ContentAction, PressKey, ScrollDirection } from "../messages";
import { elementFor } from "./extract";
import { highlight } from "./overlay";

// Long enough to see the ring land on the element before the page reacts.
const SHOW_BEFORE_ACTING_MS = 700;
const SCROLL_PAGE_FRACTION = 0.8;

const SENSITIVE_LABEL =
  /\b(pay|buy|purchase|place (my |your )?order|complete (my |your )?order|donate|subscribe|delete|transfer|send money)\b/i;
const SENSITIVE_FIELDS = 'input[type="password"], [autocomplete^="cc-"]';

const KEY_CODES: Record<PressKey, { key: string; code: string }> = {
  Enter: { key: "Enter", code: "Enter" },
  Escape: { key: "Escape", code: "Escape" },
  Tab: { key: "Tab", code: "Tab" },
  Backspace: { key: "Backspace", code: "Backspace" },
  Space: { key: " ", code: "Space" },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp" },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown" },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft" },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight" },
};

const FAILED: ActResult = { ok: false, reason: "failed" };
const SENSITIVE: ActResult = { ok: false, reason: "sensitive" };

type TextField = HTMLInputElement | HTMLTextAreaElement;

function isTextField(element: Element): element is TextField {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function isUsable(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled === true) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
}

function inSensitiveForm(element: Element): boolean {
  return element.closest("form")?.querySelector(SENSITIVE_FIELDS) != null;
}

function isSensitiveClick(element: HTMLElement): boolean {
  const label = [
    element.getAttribute("aria-label"),
    element.innerText,
    element instanceof HTMLInputElement ? element.value : "",
  ].join(" ");
  if (SENSITIVE_LABEL.test(label)) return true;

  if (!inSensitiveForm(element)) return false;
  if (element instanceof HTMLButtonElement) return element.type === "submit";
  return (
    element instanceof HTMLInputElement && (element.type === "submit" || element.type === "image")
  );
}

function pointerInit(element: HTMLElement): MouseEventInit {
  const rect = element.getBoundingClientRect();
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

// The full sequence a mouse produces. Menus and custom dropdowns often react to
// mousedown or pointerdown and ignore a bare click.
function click(element: HTMLElement): void {
  const init = pointerInit(element);
  const pointer: PointerEventInit = {
    ...init,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent("pointerdown", pointer));
  element.dispatchEvent(new MouseEvent("mousedown", init));
  element.focus({ preventScroll: true });
  element.dispatchEvent(new PointerEvent("pointerup", pointer));
  element.dispatchEvent(new MouseEvent("mouseup", init));
  element.click();
}

function hover(element: HTMLElement): void {
  const init = pointerInit(element);
  const pointer: PointerEventInit = {
    ...init,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent("pointerover", pointer));
  element.dispatchEvent(new PointerEvent("pointerenter", { ...pointer, bubbles: false }));
  element.dispatchEvent(new MouseEvent("mouseover", init));
  element.dispatchEvent(new MouseEvent("mouseenter", { ...init, bubbles: false }));
  element.dispatchEvent(new PointerEvent("pointermove", pointer));
  element.dispatchEvent(new MouseEvent("mousemove", init));
}

// Sites built with React and similar only notice a new value when it is set
// through the element's native setter and followed by an input event.
function setValue(field: TextField, text: string): void {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function choose(select: HTMLSelectElement, text: string): boolean {
  const wanted = text.trim().toLowerCase();
  const options = [...select.options];
  const option =
    options.find((item) => item.text.trim().toLowerCase() === wanted) ??
    options.find((item) => item.text.toLowerCase().includes(wanted));
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// Rich editors (an email body, a chat box) are not inputs; the browser's own
// insertText command is the one way they all accept text.
function writeIntoEditor(editor: HTMLElement, text: string): boolean {
  editor.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return false;
  selection.selectAllChildren(editor);
  return document.execCommand("insertText", false, text);
}

// Sends the key to the page, then does what the browser itself would have done
// for a real key press, unless the page handled the key.
function pressKey(target: HTMLElement, name: PressKey): ActResult {
  const init: KeyboardEventInit = {
    ...KEY_CODES[name],
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  const handledByPage = !target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  if (handledByPage) return { ok: true };

  if (name === "Enter" && target instanceof HTMLInputElement) {
    if (inSensitiveForm(target)) return SENSITIVE;
    target.form?.requestSubmit();
  } else if (
    (name === "Enter" || name === "Space") &&
    target.matches("button, a[href], [role='button'], summary")
  ) {
    if (isSensitiveClick(target)) return SENSITIVE;
    target.click();
  } else if (name === "Backspace" && isTextField(target) && !target.matches(SENSITIVE_FIELDS)) {
    setValue(target, target.value.slice(0, -1));
  } else if (name === "Tab") {
    focusNext(target);
  }
  return { ok: true };
}

function focusNext(from: HTMLElement): void {
  const stops = [
    ...document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(isUsable);
  const next = stops[stops.indexOf(from) + 1] ?? stops[0];
  next?.focus();
}

function fill(element: HTMLElement, text: string, submit: boolean): ActResult {
  if (element instanceof HTMLSelectElement) return choose(element, text) ? { ok: true } : FAILED;
  if (element.matches(SENSITIVE_FIELDS)) return SENSITIVE;

  if (isTextField(element)) {
    element.focus({ preventScroll: true });
    setValue(element, text);
  } else if (!element.isContentEditable || !writeIntoEditor(element, text)) {
    return FAILED;
  }
  if (!submit) return { ok: true };
  if (inSensitiveForm(element)) return SENSITIVE;
  // Sent just after the result, because submitting may navigate away.
  window.setTimeout(() => onLivePage(() => pressKey(element, "Enter")), 50);
  return { ok: true };
}

function isScrollable(element: Element): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  const overflow = getComputedStyle(element).overflowY;
  return overflow === "auto" || overflow === "scroll";
}

// Many sites scroll an inner panel instead of the window. The panel under the
// middle of the screen is the one a person would be scrolling.
function scroller(): Element {
  const page = document.scrollingElement ?? document.documentElement;
  let element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  while (element && element !== document.body && element !== document.documentElement) {
    if (isScrollable(element)) return element;
    element = element.parentElement;
  }
  return page;
}

function scroll(direction: ScrollDirection): ActResult {
  const area = scroller();
  const before = area.scrollTop;
  const page = area.clientHeight * SCROLL_PAGE_FRACTION;
  if (direction === "top") area.scrollTop = 0;
  else if (direction === "bottom") area.scrollTop = area.scrollHeight;
  else area.scrollTop += direction === "down" ? page : -page;
  // Unchanged means it was already at that end; the model should know.
  return area.scrollTop === before ? FAILED : { ok: true };
}

// Role 4's simple view makes the page inert while it covers it, which blocks
// focus. A step still has to reach the real control underneath.
function onLivePage<Result>(run: () => Result): Result {
  const body = document.body;
  const inert = body.inert;
  body.inert = false;
  try {
    return run();
  } finally {
    body.inert = inert;
  }
}

function targetOf(elementId: string | null): HTMLElement | null {
  if (elementId === null) {
    return document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  }
  const element = elementFor(elementId);
  return element instanceof HTMLElement && isUsable(element) ? element : null;
}

export async function act(step: ContentAction): Promise<ActResult> {
  if (step.kind === "scroll") {
    highlight(null);
    const result = scroll(step.direction);
    debug("content", `act: scroll ${step.direction} ->`, result);
    return result;
  }

  const element = targetOf(step.elementId);
  if (!element) {
    debug("content", `act: "${step.elementId}" is gone, hidden or disabled`);
    return FAILED;
  }

  if (step.elementId !== null) {
    highlight(step.elementId);
    if (step.kind === "click" && isSensitiveClick(element)) {
      debug(
        "content",
        `act: refusing to press "${step.elementId}", it looks like a payment, deletion or sign-in`,
        element,
      );
      return SENSITIVE;
    }
    await new Promise((resolve) => window.setTimeout(resolve, SHOW_BEFORE_ACTING_MS));
    if (!isUsable(element)) {
      debug("content", `act: "${step.elementId}" went away before Mack could use it`);
      return FAILED;
    }
  }

  switch (step.kind) {
    case "type": {
      const result = onLivePage(() => fill(element, step.text, step.submit));
      debug("content", `act: typing into "${step.elementId}" ->`, result, element);
      return result;
    }
    case "hover":
      debug("content", `act: hovering over "${step.elementId}"`, element);
      onLivePage(() => hover(element));
      return { ok: true };
    case "press": {
      const result = onLivePage(() => pressKey(element, step.key));
      debug("content", `act: pressing the ${step.key} key ->`, result, element);
      return result;
    }
    case "click":
      // The click may navigate away and destroy this script, so it runs just
      // after the result has been sent back.
      window.setTimeout(() => {
        debug("content", `act: clicking "${step.elementId}"`, element);
        onLivePage(() => click(element));
      }, 50);
      return { ok: true };
  }
}
