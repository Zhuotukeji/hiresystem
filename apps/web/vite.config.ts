import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@hiresystem/shared": path.resolve(__dirname, "../../packages/shared/src")
    }
  },
  server: {
    port: 5173
  }
});
