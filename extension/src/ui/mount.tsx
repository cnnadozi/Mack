import { createRoot } from "react-dom/client";
import { MackApp, type MackAppProps } from "./MackApp";
import tailwindCss from "virtual:mack-tailwind";
import { PortalContainerContext, TooltipProvider } from "./components/ui/tooltip";
import { MACK_STYLES } from "./styles";

export type MackMount = {
  /** The element Role 4 should exclude from extraction and mutation observation. */
  host: HTMLElement;
  render(props: MackAppProps): void;
  unmount(): void;
};

export function mountMackApp(parent: HTMLElement = document.documentElement): MackMount {
  const host = document.createElement("mack-root");
  host.setAttribute("data-mack", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  // Tailwind/shadcn first; Mack's own rules are unlayered, so they win where both apply.
  style.textContent = tailwindCss + MACK_STYLES;
  const container = document.createElement("div");
  shadow.append(style, container);
  parent.append(host);

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
