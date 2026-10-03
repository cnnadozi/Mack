import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LensAppProps, LensUIState } from "../../../../shared/contracts";
import { uiFixtures } from "../fixtures";
import { MackApp } from "../MackApp";

afterEach(cleanup);

function setup(state: LensUIState) {
  const props: LensAppProps = {
    state,
    onAction: vi.fn(),
    onRequest: vi.fn(),
    onMicStart: vi.fn(),
    onMicStop: vi.fn(),
    onReplay: vi.fn(),
    onBack: vi.fn(),
    onShowOriginal: vi.fn(),
    onRetry: vi.fn(),
    onExit: vi.fn(),
    onRendered: vi.fn(),
  };
  const view = render(<MackApp {...props} />);
  return { props, ...view, rerenderWith: (next: LensUIState) => view.rerender(<MackApp {...props} state={next} />) };
}

describe("MackApp", () => {
  it("renders every section and button with its action id", () => {
    const { props } = setup(uiFixtures.manyGrouped);
    expect(screen.getByRole("heading", { level: 1, name: "Library home" })).toBeTruthy();
    for (const name of ["Find something", "Visit", "Your account"]) screen.getByRole("heading", { level: 2, name });
    const buttons = document.querySelectorAll("[data-action-id]");
    expect(buttons).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Pay a fine" }));
    expect(props.onAction).toHaveBeenCalledWith("b6");
  });

  it("renders a two-action screen without headings", () => {
    setup(uiFixtures.twoActions);
    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(2);
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });

  it("acknowledges each committed screen version exactly once", () => {
    const { props, rerenderWith } = setup(uiFixtures.manyGrouped);
    rerenderWith({ ...uiFixtures.manyGrouped, transcript: "typing" });
    rerenderWith({ ...uiFixtures.manyGrouped, busy: true });
    expect(props.onRendered).toHaveBeenCalledTimes(1);
    expect(props.onRendered).toHaveBeenCalledWith("v-many");
    rerenderWith(uiFixtures.withAddition);
    expect(props.onRendered).toHaveBeenCalledTimes(2);
    expect(props.onRendered).toHaveBeenLastCalledWith("v-add");
  });

  it("highlights the accepted addition with a non-color cue", () => {
    setup(uiFixtures.withAddition);
    const target = screen.getByRole("button", { name: /Contact the library/ });
    expect(target.getAttribute("data-highlighted")).toBe("true");
    expect(within(target).getByText("Next step")).toBeTruthy();
    expect(target.getAttribute("aria-describedby")).toBeTruthy();
    screen.getByRole("heading", { name: "For your request" });
    expect(screen.getByText("Press “Contact the library”.")).toBeTruthy();
    expect(document.querySelectorAll('[data-highlighted="true"]')).toHaveLength(1);
  });

  it("shows the transcript for correction and submits the edited text", () => {
    const { props } = setup(uiFixtures.withAddition);
    const input = screen.getByLabelText("What do you want to do?") as HTMLInputElement;
    expect(input.value).toBe("how do I talk to someone");
    fireEvent.change(input, { target: { value: "how do I call someone" } });
    fireEvent.submit(input.closest("form")!);
    expect(props.onRequest).toHaveBeenCalledWith("how do I call someone");
    expect(input.value).toBe("");
  });

  it("does not submit empty text", () => {
    const { props } = setup(uiFixtures.manyGrouped);
    fireEvent.submit(screen.getByLabelText("What do you want to do?").closest("form")!);
    expect(props.onRequest).not.toHaveBeenCalled();
  });

  it("routes mic, replay, back, original and exit through callbacks", () => {
    const { props, rerenderWith } = setup(uiFixtures.withAddition);
    fireEvent.click(screen.getByRole("button", { name: /Speak/ }));
    expect(props.onMicStart).toHaveBeenCalled();
    rerenderWith({ ...uiFixtures.withAddition, voiceState: "listening" });
    const stop = screen.getByRole("button", { name: /Stop/ });
    expect(stop.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(stop);
    expect(props.onMicStop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Repeat instruction/ }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Original page" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mack" }));
    expect(props.onReplay).toHaveBeenCalled();
    expect(props.onBack).toHaveBeenCalled();
    expect(props.onShowOriginal).toHaveBeenCalled();
    expect(props.onExit).toHaveBeenCalled();
  });

  it("sends clarification choices as requests", () => {
    const { props } = setup(uiFixtures.clarification);
    fireEvent.click(screen.getByRole("button", { name: "Renew borrowed items" }));
    expect(props.onRequest).toHaveBeenCalledWith("Renew borrowed items");
  });

  it("keeps typing usable when there is an error and the mic is unavailable", () => {
    const { props } = setup(uiFixtures.error);
    expect(screen.getByRole("alert").textContent).toContain("Mack could not answer just now.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalled();
    screen.getByText(/You can type instead/);
    const input = screen.getByLabelText("What do you want to do?");
    fireEvent.change(input, { target: { value: "hours" } });
    fireEvent.submit(input.closest("form")!);
    expect(props.onRequest).toHaveBeenCalledWith("hours");
  });

  it("shows a loading state and an honest empty state", () => {
    const { rerenderWith } = setup(uiFixtures.loading);
    screen.getByText("Working…");
    expect(screen.queryByText(/No simple actions/)).toBeNull();
    rerenderWith(uiFixtures.empty);
    screen.getByText(/No simple actions are ready/);
  });

  it("renders only a compact movable guide in original mode", () => {
    const { props } = setup(uiFixtures.original);
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(props.onBack).toHaveBeenCalled();
    const panel = screen.getByRole("complementary", { name: "Mack guide" });
    expect(document.querySelector(".mack-overlay")).toBeNull();
    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(0);
    expect(panel.getAttribute("data-dock")).toBe("bottom-right");
    act(() => fireEvent.click(screen.getByRole("button", { name: /Move this panel/ })));
    expect(panel.getAttribute("data-dock")).toBe("bottom-left");
    screen.getByLabelText("Ask Mack");
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  });

  it("offers Previous page in both views only through onPreviousPage when provided", () => {
    const onPreviousPage = vi.fn();
    const { props } = setup(uiFixtures.original);
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mack" }));
    expect(props.onExit).toHaveBeenCalled();
    cleanup();
    const view = render(<MackApp {...props} onPreviousPage={onPreviousPage} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    view.rerender(<MackApp {...props} onPreviousPage={onPreviousPage} state={uiFixtures.manyGrouped} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPreviousPage).toHaveBeenCalledTimes(2);
    expect(props.onBack).not.toHaveBeenCalled();
  });

  it("uses native buttons so every control is keyboard reachable", () => {
    setup(uiFixtures.withAddition);
    const controls = document.querySelectorAll("button, input");
    controls.forEach((el) => expect((el as HTMLElement).tabIndex).toBe(0));
  });
});
