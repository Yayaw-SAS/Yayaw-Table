import path from "node:path";
import aliasPlugin from "esbuild-plugin-alias";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["../../src/data-table/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  target: "es2020",
  shims: false,
  esbuildPlugins: [
    aliasPlugin({
      "@": path.resolve(__dirname, "../../src"),
      "@/lib": path.resolve(__dirname, "../../src/lib"),
      "@/components": path.resolve(__dirname, "../../src/components"),
      "@/hooks": path.resolve(__dirname, "../../src/hooks"),
      "@/providers": path.resolve(__dirname, "../../src/providers"),
      "@/utils": path.resolve(__dirname, "../../src/utils"),
      "@/types": path.resolve(__dirname, "../../src/types"),
    }),
  ],
  external: [
    "react",
    "react-dom",
    "@tanstack/react-table",
    "jotai",
    "jotai/utils",
    "@tanstack/react-query",
  ],
  banner: {
    js: '"use client";',
  },
});
