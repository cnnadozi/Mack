import { expect, it } from "vitest";
import { shadowStyles } from "../mount";

it("switches on Tailwind's plain-rule defaults, which a shadow root needs", () => {
  const guard =
    "@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b))))";
  const css = `@layer properties{${guard}{*{--tw-border-style:solid}}}.a{color:red}`;
  expect(shadowStyles(css)).toBe(
    "@layer properties{@supports (color: red) {*{--tw-border-style:solid}}}.a{color:red}",
  );
  expect(shadowStyles(".a{color:red}")).toBe(".a{color:red}");
});
