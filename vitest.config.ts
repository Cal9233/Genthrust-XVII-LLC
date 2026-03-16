import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    include: [
      "__tests__/**/*.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "trigger/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      ".claude/**",
      "**/.claude/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
