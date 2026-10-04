// Copies the provider keys from .env.local into extension/local-env.js so the
// unpacked extension can read them. A Chrome extension cannot read .env files, and
// this repo has no bundler to inject them. Both files are ignored by git.
//
// Usage: node scripts/sync-env.mjs   (rerun after editing .env.local, then reload the extension)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Only these names are copied, so unrelated secrets in .env.local stay out of the extension.
const NAMES = ["ELEVENLABS_API_KEY", "GEMINI_API_KEY"];

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(`${root}.env.local`, "utf8");

const values = new Map();
for (const line of source.split("\n")) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (match) values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/, "$2"));
}

const lines = [
  "// GENERATED from .env.local by scripts/sync-env.mjs. Ignored by git. Do not commit or share.",
  ...NAMES.map((name) => `export const ${name} = ${JSON.stringify(values.get(name) ?? "")};`),
];
writeFileSync(`${root}extension/local-env.js`, `${lines.join("\n")}\n`, { mode: 0o600 });

for (const name of NAMES) {
  console.log(`${name}: ${values.get(name) ? "copied" : "MISSING in .env.local"}`);
}
