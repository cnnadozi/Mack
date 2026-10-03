// DEVELOPMENT FIXTURES ONLY. They unblock component work before live extraction and model access exist.
// They are not demo data and must never be wired into the real extension flow.
import type { CommittedScreen, LensUIState, ModelClient, PageSnapshot, ScreenSection } from "../../../shared/contracts";

export const fixtureSnapshot: PageSnapshot = {
  version: "snap-fixture-1",
  pageUrl: "https://example.org/",
  title: "Example Library — Home",
  headings: ["Welcome to the library", "Events", "Your account"],
  context: "Public library home page with catalog search, events, hours, and account links.",
  actions: [
    { id: "a1", label: "Catalog", kind: "navigate", context: "Main menu", disabled: false, href: "https://example.org/catalog" },
    { id: "a2", label: "Hours & Locations", kind: "navigate", context: "Main menu", disabled: false, href: "https://example.org/hours" },
    { id: "a3", label: "Events", kind: "navigate", context: "Main menu", disabled: false, href: "https://example.org/events" },
    { id: "a4", label: "Hours & Locations", kind: "navigate", context: "Footer", disabled: false, href: "https://example.org/hours" },
    { id: "a5", label: "My Account", kind: "navigate", context: "Header", disabled: false, href: "https://example.org/account" },
    { id: "a6", label: "Search", kind: "field", context: "Catalog search box", disabled: false },
    { id: "a7", label: "Go", kind: "submit", context: "Catalog search", disabled: false },
    { id: "a8", label: "Renew items", kind: "button", context: "Account panel", disabled: true },
    { id: "a9", label: "Privacy policy", kind: "navigate", context: "Footer", disabled: false, href: "https://example.org/privacy" },
    { id: "a10", label: "Contact us", kind: "navigate", context: "Footer", disabled: false, href: "https://example.org/contact" },
  ],
};

/** A canned design response, including mistakes the validator must remove. */
export const fixtureModelDesign = {
  status: "ready",
  title: "Library home",
  sections: [
    {
      heading: "Find something",
      buttons: [
        { actionId: "a1", label: "Search for books and movies" },
        { actionId: "a3", label: "See upcoming events" },
        { actionId: "ghost", label: "Invented action" },
        { actionId: "a6", label: "Type a search" },
      ],
    },
    {
      heading: "Visit",
      buttons: [
        { actionId: "a2", label: "Opening hours and locations" },
        { actionId: "a4", label: "Hours (footer copy)" },
        { actionId: "a8", label: "Renew my items" },
      ],
    },
    { heading: "Your account", buttons: [{ actionId: "a5", label: "Sign in to my account" }] },
  ],
};

export function createFixtureModelClient(response: unknown = fixtureModelDesign, delayMs = 300): ModelClient {
  return {
    generateJSON: (_input, signal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(structuredClone(response)), delayMs);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      }),
  };
}

function screen(version: string, title: string, sections: ScreenSection[], mode: CommittedScreen["mode"] = "simplified"): CommittedScreen {
  return { title, mode, sections, snapshotVersion: "snap-fixture-1", screenVersion: version };
}

function base(s: CommittedScreen, extra: Partial<LensUIState> = {}): LensUIState {
  return { screen: s, instruction: "", transcript: "", voiceState: "idle", busy: false, ...extra };
}

const many: ScreenSection[] = [
  {
    id: "s1",
    heading: "Find something",
    buttons: [
      { actionId: "a1", label: "Search for books and movies" },
      { actionId: "a3", label: "See upcoming events" },
      { actionId: "b1", label: "Browse new arrivals" },
      { actionId: "b2", label: "Kids and teens" },
    ],
  },
  {
    id: "s2",
    heading: "Visit",
    buttons: [
      { actionId: "a2", label: "Opening hours and locations" },
      { actionId: "b3", label: "Book a meeting room" },
      { actionId: "b4", label: "Get a library card" },
    ],
  },
  {
    id: "s3",
    heading: "Your account",
    buttons: [
      { actionId: "a5", label: "Sign in to my account" },
      { actionId: "b5", label: "See what I have borrowed" },
      { actionId: "b6", label: "Pay a fine" },
      { actionId: "b7", label: "Change my pickup location" },
      { actionId: "b8", label: "Reading history" },
    ],
  },
];

export const uiFixtures: Record<string, LensUIState> = {
  loading: base(screen("v-loading", "Getting this page ready…", []), { busy: true }),
  twoActions: base(
    screen("v-two", "Order confirmation", [
      { id: "s1", buttons: [{ actionId: "c1", label: "Track my order" }, { actionId: "c2", label: "Go back to the shop" }] },
    ]),
  ),
  manyGrouped: base(screen("v-many", "Library home", many)),
  withAddition: base(
    screen("v-add", "Library home", [
      ...many.slice(0, 2),
      { id: "request", heading: "For your request", buttons: [{ actionId: "a10", label: "Contact the library" }] },
    ]),
    { instruction: "Press “Contact the library”.", highlightedActionId: "a10", transcript: "how do I talk to someone", voiceState: "speaking" },
  ),
  clarification: base(screen("v-clar", "Library home", many.slice(0, 1)), {
    instruction: "Which one do you mean?",
    transcript: "renew",
    clarificationOptions: ["Renew my library card", "Renew borrowed items"],
  }),
  error: base(screen("v-err", "Library home", many.slice(0, 1)), {
    error: { code: "guide_model_failed", message: "Mack could not answer just now.", retryable: true },
    voiceState: "error",
  }),
  empty: base(screen("v-empty", "Library home", [])),
  goalWithMore: base(
    screen("v-goal", "Find a doctor", [
      { id: "main-1", heading: "Find a doctor", buttons: [{ actionId: "d1", label: "Search for a doctor near you" }, { actionId: "d2", label: "Find a doctor in your plan" }] },
      { id: "more-2", heading: "Other tasks", buttons: [{ actionId: "d3", label: "Check claims (sign in first)" }, { actionId: "d4", label: "Get your ID card" }] },
      { id: "more-3", heading: "Help", buttons: [{ actionId: "d5", label: "Contact customer support" }] },
    ]),
    { instruction: "Continuing: “Find a doctor”. Choose the next step." },
  ),
  original: base(screen("v-orig", "Fill in the sign-up form", [], "original"), {
    instruction: "Type your email address in the highlighted box on the page.",
  }),
};
