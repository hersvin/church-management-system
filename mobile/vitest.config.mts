import { defineConfig } from "vitest/config";

// Plain logic only (no React Native imports): API client, QR routing, formatting.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
