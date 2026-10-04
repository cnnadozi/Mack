import type { CSSProperties } from "react";

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// Used when the site has no recognizable brand color.
const DEFAULT_ACCENT = "#2457c5";
// WCAG AA for normal text; the accent is used for text, borders and white-on-accent buttons.
const MIN_CONTRAST = 4.5;

function toRgb(hex: string): Rgb | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return undefined;
  return [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (rgb: Rgb) => `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

const mix = (a: Rgb, b: Rgb, amountOfB: number): Rgb => a.map((v, i) => v + (b[i]! - v) * amountOfB) as Rgb;

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [toRgb(a), toRgb(b)];
  if (!x || !y) return 1;
  const [hi, lo] = [luminance(x), luminance(y)].sort((m, n) => n - m) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export type ThemeMode = "light" | "dark";

// Dark mode surfaces; the accent must stay readable on the card color.
const DARK_SURFACE = "#1a1d24";
const DARK_PAGE = "#0f1115";

export type Palette = {
  accent: string; // readable as text on the mode's cards, and as a button color under onAccent
  onAccent: string; // text color on accent-filled buttons
  accentSoft: string; // page background tint
  accentTint: string; // icon tiles and hover fills
  accentLine: string; // decorative borders
};

/**
 * Turns a site's brand color into an accessible palette for light or dark mode: darkened on white in light mode,
 * lightened on dark cards in dark mode, until text and button labels both reach WCAG AA.
 */
export function paletteFor(brand?: string, mode: ThemeMode = "light"): Palette {
  let accent = toRgb(brand ?? "") ?? toRgb(DEFAULT_ACCENT)!;
  if (mode === "light") {
    for (let i = 0; i < 30 && contrast(toHex(accent), "#ffffff") < MIN_CONTRAST; i++) accent = mix(accent, BLACK, 0.08);
    return {
      accent: toHex(accent),
      onAccent: "#ffffff",
      accentSoft: toHex(mix(accent, WHITE, 0.94)),
      accentTint: toHex(mix(accent, WHITE, 0.86)),
      accentLine: toHex(mix(accent, WHITE, 0.6)),
    };
  }
  const surface = toRgb(DARK_SURFACE)!;
  for (let i = 0; i < 30 && contrast(toHex(accent), DARK_SURFACE) < MIN_CONTRAST; i++) accent = mix(accent, WHITE, 0.08);
  const hex = toHex(accent);
  return {
    accent: hex,
    onAccent: contrast(hex, DARK_PAGE) >= contrast(hex, "#ffffff") ? DARK_PAGE : "#ffffff",
    accentSoft: toHex(mix(accent, toRgb(DARK_PAGE)!, 0.9)),
    accentTint: toHex(mix(accent, surface, 0.78)),
    accentLine: toHex(mix(accent, surface, 0.5)),
  };
}

export function themeStyle(brand?: string, mode: ThemeMode = "light"): CSSProperties {
  const p = paletteFor(brand, mode);
  return {
    "--brand": p.accent,
    "--on-brand": p.onAccent,
    "--brand-soft": p.accentSoft,
    "--brand-tint": p.accentTint,
    "--brand-line": p.accentLine,
  } as CSSProperties;
}
