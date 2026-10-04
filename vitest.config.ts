import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://www.uhc.com/" } },
    globals: true,
    include: ["shared/**/*.test.ts", "extension/src/**/*.test.{ts,tsx}"],
    // These use Node's built-in test runner and are run by "npm run test:node".
    exclude: [
      "extension/src/guidance/**",
      "extension/src/voice/**",
      "extension/src/platform/gemini.test.ts",
      "extension/src/platform/cache.test.ts",
    ],
  },
});
