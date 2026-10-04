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

export type Palette = {
  accent: string; // readable on white, and white text is readable on it
  accentSoft: string; // page background tint
  accentTint: string; // hover and selected fills
  accentLine: string; // decorative borders
};

/** Turns a site's brand color into an accessible palette, darkening it until white text and white backgrounds both pass AA. */
export function paletteFor(brand?: string): Palette {
  let accent = toRgb(brand ?? "") ?? toRgb(DEFAULT_ACCENT)!;
  for (let i = 0; i < 30 && contrast(toHex(accent), "#ffffff") < MIN_CONTRAST; i++) accent = mix(accent, BLACK, 0.08);
  return {
    accent: toHex(accent),
    accentSoft: toHex(mix(accent, WHITE, 0.94)),
    accentTint: toHex(mix(accent, WHITE, 0.86)),
    accentLine: toHex(mix(accent, WHITE, 0.6)),
  };
}

export function themeStyle(brand?: string): CSSProperties {
  const p = paletteFor(brand);
  return {
    "--accent": p.accent,
    "--accent-soft": p.accentSoft,
    "--accent-tint": p.accentTint,
    "--accent-line": p.accentLine,
  } as CSSProperties;
}
