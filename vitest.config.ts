import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["shared/**/*.test.ts", "extension/src/**/*.test.{ts,tsx}"],
    exclude: ["extension/src/guidance/**"],
  },
});
