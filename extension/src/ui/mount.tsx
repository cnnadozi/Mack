import { createRoot } from "react-dom/client";
import { MackApp, type MackAppProps } from "./MackApp";
import { loadMackFont } from "./font";
import { MACK_STYLES } from "./styles";
// The compiled Tailwind and shadcn styles as text, because they go into a shadow root.
import tailwind from "./styles.css?inline";

export type MackMount = {
  /** The element Role 4 should exclude from extraction and mutation observation. */
  host: HTMLElement;
  render(props: MackAppProps): void;
  unmount(): void;
};

// Two things Tailwind takes for granted do not hold inside a shadow root on someone
// else's page:
// - "rem" follows the website's root font size, which many sites change, so the
//   theme's sizes are restated in pixels.
// - @property rules are ignored there, so Tailwind's fallback that sets the same
//   defaults with a plain rule is switched on (see shadowStyles below).
const HOST_STYLES = `
:host {
  all: initial;
  --spacing: 4px;
  --radius: 12px;
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px; --text-lg: 18px;
  --text-xl: 20px; --text-2xl: 24px; --text-3xl: 30px;
}
/* shadcn's tokens in styles.css are the light theme. The host element gets
   data-theme="dark" from whoever mounts the shadow root. */
:host([data-theme="dark"]) {
  --background: #1c1c20; --foreground: #f4f4f5; --card: #232328; --card-foreground: #f4f4f5;
  --primary: #f4f4f5; --primary-foreground: #18181b; --secondary: #2c2c33; --secondary-foreground: #f4f4f5;
  --muted: #2c2c33; --muted-foreground: #a5a5b0; --accent: #2c2c33; --accent-foreground: #f4f4f5;
  --input: #3f3f48; --border: #34343c; --ring: #8b8b96; --destructive: #f87171;
  color-scheme: dark;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

// Tailwind only applies its defaults for --tw-* variables with a plain rule in
// browsers that lack @property. Its guard is replaced with one that is always true.
export function shadowStyles(css: string): string {
  return css.replace(/(@layer properties\s*\{\s*)@supports[^{]+\{/, "$1@supports (color: red) {");
}

/** The stylesheet for any shadow root that holds shadcn/ui components. */
export function shadowStyleText(): string {
  return shadowStyles(tailwind) + HOST_STYLES;
}

export function mountMackApp(parent: HTMLElement = document.documentElement): MackMount {
  const host = document.createElement("mack-root");
  host.setAttribute("data-mack", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  // Mack's own layout and brand rules come after Tailwind/shadcn; they are unlayered, so they win.
  style.textContent = shadowStyleText() + MACK_STYLES;
  const container = document.createElement("div");
  shadow.append(style, container);
  parent.append(host);
  void loadMackFont();

  const root = createRoot(container);
  return {
    host,
    render: (props) => root.render(<MackApp {...props} />),
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
