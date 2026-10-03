import { build } from "esbuild";
import { cp, mkdir, readFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
const common = {
  bundle: true,
  target: "chrome120",
  minify: true,
  sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
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
