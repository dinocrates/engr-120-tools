import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Served from https://dinocrates.github.io/engr-120-tools/pneumatics-simulator/
// The Pages workflow assembles the multi-tool site; this base must match that path.
export default defineConfig({
  base: process.env.PNEUMATICS_BASE ?? "/engr-120-tools/pneumatics-simulator/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
});
