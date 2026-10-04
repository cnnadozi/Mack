import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://www.uhc.com/" } },
    globals: true,
    include: ["shared/**/*.test.ts", "extension/src/**/*.test.{ts,tsx}"],
    exclude: ["extension/src/guidance/**"],
  },
});
