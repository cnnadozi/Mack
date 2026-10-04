import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./extension/manifest.json";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromRoot("./extension"),
  // Keys live in .env.local at the repo root. Only code that reads
  // import.meta.env.ELEVENLABS_API_KEY / GEMINI_API_KEY gets them inlined;
  // that must stay limited to the offscreen document, never a content script.
  envDir: fromRoot("."),
  envPrefix: ["VITE_", "ELEVENLABS_", "GEMINI_"],
  resolve: { alias: { "@": fromRoot("./extension/src/ui") } },
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    outDir: fromRoot("./dist"),
    emptyOutDir: true,
    rollupOptions: {
      // Pages the manifest does not mention still need to be built.
      input: {
        offscreen: fromRoot("./extension/offscreen.html"),
        permission: fromRoot("./extension/permission.html"),
      },
    },
  },
});
