import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@hiresystem/shared": path.resolve(__dirname, "../../packages/shared/src")
    }
  },
  test: {
    environment: "node"
  }
});
