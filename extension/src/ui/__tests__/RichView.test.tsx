import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LensAppProps } from "../../../../shared/contracts";
import { readDetails, type ScreenDetails } from "../details";
import { uiFixtures } from "../fixtures";
import { MackApp } from "../MackApp";

afterEach(cleanup);

function setup(details: ScreenDetails, state = uiFixtures.withAddition) {
  const props: LensAppProps = {
    state,
    onAction: vi.fn(),
    onRequest: vi.fn(),
    onMicStart: vi.fn(),
    onMicStop: vi.fn(),
    onReplay: vi.fn(),
    onBack: vi.fn(),
    onPreviousPage: vi.fn(),
    onShowOriginal: vi.fn(),
    onRetry: vi.fn(),
    onExit: vi.fn(),
    onRendered: vi.fn(),
  };
  render(<MackApp {...props} embedded details={details} />);
  return props;
}

describe("the detail read from the model's design", () => {
  it("keeps summary, facts, descriptions and known icons, and drops the rest", () => {
    const details = readDetails({
      summary: "  The library's home page.  ",
      highlights: [
        { title: "Open today", text: "9am to 8pm" },
        { title: "", text: "no title" },
        "junk",
      ],
      sections: [
        {
          heading: "Find  Something",
          description: "Search the catalogue.",
          buttons: [
            { actionId: "a1", label: "Search", description: "Look for books.", icon: "search" },
            { actionId: "a3", label: "Events", icon: "rocket" },
            { label: "no id", description: "ignored" },
          ],
        },
      ],
    });
    expect(details.summary).toBe("The library's home page.");
    expect(details.highlights).toEqual([{ title: "Open today", text: "9am to 8pm" }]);
    expect(details.sections).toEqual({
      "find something": { description: "Search the catalogue." },
    });
    expect(details.actions).toEqual({
      a1: { description: "Look for books.", icon: "search" },
      a3: {},
    });
  });

  it("never throws on a malformed answer", () => {
    for (const bad of [null, "text", 5, { sections: "x", highlights: {} }]) {
      expect(readDetails(bad)).toMatchObject({ sections: {}, actions: {} });
    }
  });
});

describe("the simple view as a redesign of the page", () => {
  const state = uiFixtures.withAddition;
  const first = state.screen.sections[0]!;
  const details: ScreenDetails = {
    site: { name: "Example Library", color: "rgb(20, 90, 200)", lightText: true },
    summary: "Find books, events and opening hours.",
    highlights: [{ title: "Open today", text: "9am to 8pm" }],
    sections: { [first.heading!.toLowerCase()]: { description: "Start here." } },
    actions: {
      [first.buttons[0]!.actionId]: { description: "Look through the catalogue.", icon: "search" },
    },
  };

  it("shows the site, the summary, the facts and a description on each card", () => {
    setup(details);
    screen.getByText("Example Library");
    screen.getByRole("heading", { level: 1, name: state.screen.title });
    screen.getByText("Find books, events and opening hours.");
    screen.getByText("9am to 8pm");
    screen.getByText("Start here.");
    const card = screen.getByRole("button", { name: new RegExp(first.buttons[0]!.label) });
    within(card).getByText("Look through the catalogue.");
  });

  it("keeps every button working exactly as in the plain view", () => {
    const props = setup(details);
    const total = state.screen.sections.reduce(
      (count, section) => count + section.buttons.length,
      0,
    );
    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(total);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first.buttons[0]!.label) }));
    expect(props.onAction).toHaveBeenCalledWith(first.buttons[0]!.actionId);
    const next = document.querySelector('[data-highlighted="true"]')!;
    within(next as HTMLElement).getByText("Next step");
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Original page" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mack" }));
    expect(props.onPreviousPage).toHaveBeenCalled();
    expect(props.onShowOriginal).toHaveBeenCalled();
    expect(props.onExit).toHaveBeenCalled();
  });

  it("shows everything, including what the plain view keeps behind More options", () => {
    setup({}, uiFixtures.goalWithMore);
    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /More options/ })).toBeNull();
  });

  it("offers the page's own search box", () => {
    const onSearch = vi.fn();
    setup({ search: { label: "Search the catalogue", onSearch } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the catalogue" }), {
      target: { value: " dune " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledWith("dune");
  });
});
