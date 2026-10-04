import { createRoot } from "react-dom/client";
import { MackApp, type MackAppProps } from "./MackApp";
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
  style.textContent = MACK_STYLES;
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
