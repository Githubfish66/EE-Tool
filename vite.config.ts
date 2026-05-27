import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/rlc-original": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", "dist/**", "r2-file-share/**"],
  },
});
