import { describe, expect, it } from "vitest";
import { taskIcon } from "../taskIcon";
import { contrast, paletteFor } from "../theme";
import { ArrowRight, IdCard, LogIn, MessageCircle, Pill, Receipt, Stethoscope } from "lucide-react";

describe("paletteFor", () => {
  it("keeps a brand color that is already readable", () => {
    expect(paletteFor("#002677").accent).toBe("#002677");
  });

  it("darkens light brand colors until white text and white backgrounds pass AA", () => {
    for (const brand of ["#ffd000", "#196ecf", "#06748c", "#87ceeb", "#ff6600"]) {
      const { accent } = paletteFor(brand);
      expect(contrast(accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lightens brand colors in dark mode until they read on dark cards, with a readable button label", () => {
    for (const brand of ["#002677", "#06748c", "#1a1446", "#ffd000", "#e32b31"]) {
      const p = paletteFor(brand, "dark");
      expect(contrast(p.accent, "#1a1d24")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("falls back to a readable default for missing or invalid colors", () => {
    for (const brand of [undefined, "", "red", "#12345"]) {
      expect(contrast(paletteFor(brand).accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("taskIcon", () => {
  it("matches common tasks, preferring the task over the sign-in suffix", () => {
    expect(taskIcon("Check claims (sign in first)")).toBe(Receipt);
    expect(taskIcon("Get your ID card")).toBe(IdCard);
    expect(taskIcon("Find a doctor near you")).toBe(Stethoscope);
    expect(taskIcon("Refill a prescription")).toBe(Pill);
    expect(taskIcon("Sign in to my account")).toBe(LogIn);
    expect(taskIcon("Contact customer support")).toBe(MessageCircle);
    expect(taskIcon("Something else entirely")).toBe(ArrowRight);
  });
});
