import { build } from "esbuild";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";

// Tailwind's @property registrations do not apply inside a shadow root, and its fallback defaults sit behind an
// @supports that Chrome skips, so shadows/rings would break in Mack's shadow DOM. Unwrap the defaults instead.
export function shadowSafe(css) {
  const start = css.indexOf("@layer properties{@supports");
  if (start === -1) return css;
  const open = css.indexOf("{", css.indexOf("@supports", start));
  let depth = 0, end = open;
  for (; end < css.length; end++) {
    if (css[end] === "{") depth++;
    else if (css[end] === "}" && --depth === 0) break;
  }
  return css.slice(0, start) + "@layer properties{" + css.slice(open + 1, end) + css.slice(end + 1);
}

async function tailwindCss() {
  const out = "dist/.mack-tailwind.css";
  await promisify(execFile)("node_modules/.bin/tailwindcss", ["-i", "extension/src/ui/mack.css", "-o", out, "--minify"]);
  const css = shadowSafe(await readFile(out, "utf8"));
  await rm(out);
  return css;
}

const css = await tailwindCss();
const mackTailwind = {
  name: "mack-tailwind",
  setup(b) {
    b.onResolve({ filter: /^virtual:mack-tailwind$/ }, () => ({ path: "mack-tailwind", namespace: "mack" }));
    b.onLoad({ filter: /.*/, namespace: "mack" }, () => ({ contents: `export default ${JSON.stringify(css)};`, loader: "js" }));
  },
};

await mkdir("dist", { recursive: true });
const common = {
  bundle: true,
  target: "chrome120",
  minify: true,
  sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
  plugins: [mackTailwind],
};
const content = await build({ ...common, entryPoints: ["extension/src/content.ts"], outfile: "dist/content.js", format: "iife" });
await build({ ...common, entryPoints: ["extension/src/service-worker.ts"], outfile: "dist/service-worker.js", format: "esm" });
await build({ ...common, entryPoints: ["extension/src/options.ts"], outfile: "dist/options.js", format: "esm" });
for (const file of ["manifest.json", "options.html", "options.css"]) await cp(`extension/${file}`, `dist/${file}`);
for (const input of Object.keys(content.metafile.inputs)) {
  if (input.includes("platform/provider") || input.includes("service-worker")) throw new Error("Provider code leaked into content bundle");
}
const bundled = await readFile("dist/content.js", "utf8");
if (bundled.includes("generativelanguage.googleapis.com") || /AIza[0-9A-Za-z_-]{20,}/.test(bundled)) throw new Error("Provider endpoint or key leaked into content bundle");
for (const file of ["service-worker.js", "options.js"]) {
  if (/AIza[0-9A-Za-z_-]{20,}/.test(await readFile(`dist/${file}`, "utf8"))) throw new Error(`An API key was bundled into ${file}`);
}
const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected Manifest V3");
console.log("Built unpacked extension in dist/ (content IIFE, worker ESM).");
