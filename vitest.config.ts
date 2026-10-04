import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tests don't need the compiled stylesheet.
  resolve: { alias: { "virtual:mack-tailwind": new URL("./test/tailwind-stub.ts", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://www.uhc.com/" } },
    globals: true,
    include: ["shared/**/*.test.ts", "extension/src/**/*.test.{ts,tsx}"],
    exclude: ["extension/src/guidance/**"],
  },
});
