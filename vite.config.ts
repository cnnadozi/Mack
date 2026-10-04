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
  // import.meta.env.ELEVENLABS_API_KEY / GEMINI_API_KEY gets them inlined; that
  // must stay limited to the offscreen document and the background service
  // worker, never a content script or a page a website can reach.
  envDir: fromRoot("."),
  envPrefix: ["VITE_", "ELEVENLABS_", "GEMINI_"],
  resolve: { alias: { "@": fromRoot("./extension/src/ui") } },
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    outDir: fromRoot("./dist"),
    emptyOutDir: true,
    // Vite's preloading adds <link> tags to the document. For the content script
    // that document is the website, which must not get extension links added to it.
    modulePreload: false,
    rollupOptions: {
      // Pages the manifest does not mention still need to be built.
      input: {
        offscreen: fromRoot("./extension/offscreen.html"),
        permission: fromRoot("./extension/permission.html"),
      },
    },
  },
});
