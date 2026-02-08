import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Note: "localstorage-file was provided without a valid path" is a Node.js warning
  // during static generation (workers). Safe to ignore or use Node 22 LTS to avoid it.

  // Force a single Jotai instance to avoid dual CJS/ESM package hazard
  // See: https://github.com/pmndrs/jotai/discussions/2044
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      jotai: resolve("./node_modules/jotai"),
    };
    return webpackConfig;
  },
};

export default withMDX(config);
