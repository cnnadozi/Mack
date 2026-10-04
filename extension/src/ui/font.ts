// Atkinson Hyperlegible Next (SIL OFL, extension/public/fonts/OFL.txt), made by the
// Braille Institute for low-vision readers. Shadow roots ignore @font-face, so the face
// is added to the page's own font set, under a name no website uses. It is loaded from
// bytes rather than a URL, so a site's Content-Security-Policy cannot block it.
export const MACK_FONT = "Mack Atkinson Hyperlegible";

const FILES: { file: string; unicodeRange: string }[] = [
  {
    file: "fonts/atkinson-hyperlegible-next-latin.woff2",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    file: "fonts/atkinson-hyperlegible-next-latin-ext.woff2",
    unicodeRange:
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
];

let loading: Promise<void> | undefined;

/** Adds Mack's face to the page once; until it arrives (or if it cannot), the system sans is used. */
export function loadMackFont(): Promise<void> {
  if (loading) return loading;
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL || typeof FontFace === "undefined") {
    return (loading = Promise.resolve());
  }
  loading = Promise.all(
    FILES.map(async ({ file, unicodeRange }) => {
      const bytes = await (await fetch(chrome.runtime.getURL(file))).arrayBuffer();
      const face = new FontFace(MACK_FONT, bytes, { weight: "200 800", style: "normal", display: "swap", unicodeRange });
      document.fonts.add(await face.load());
    }),
  ).then(
    () => undefined,
    () => undefined,
  );
  return loading;
}
