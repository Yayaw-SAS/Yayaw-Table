import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Note: "localstorage-file was provided without a valid path" is a Node.js warning
  // during static generation (workers). Safe to ignore or use Node 22 LTS to avoid it.
};

export default withMDX(config);
