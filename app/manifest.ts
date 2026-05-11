import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#071019",
    categories: ["developer", "productivity", "utilities"],
    description:
      "Open-source React data table for Shadcn UI and TanStack Table, with URL state, server-side workflows, bulk actions, and full code ownership.",
    display: "standalone",
    icons: [
      {
        sizes: "16x16",
        src: "/favicon-16x16.png",
        type: "image/png",
      },
      {
        sizes: "32x32",
        src: "/favicon-32x32.png",
        type: "image/png",
      },
      {
        sizes: "192x192",
        src: "/android-chrome-192x192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/android-chrome-512x512.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "any",
        src: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    lang: "en",
    name: "YaYaw Table",
    short_name: "YaYaw Table",
    start_url: "/",
    theme_color: "#071019",
  };
}
