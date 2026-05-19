export const siteConfig = {
  description:
    "Open-source React data table for Shadcn UI and TanStack Table, with URL state, server-side workflows, bulk actions, and full code ownership.",
  githubUrl: "https://github.com/Yayaw-eu/Yayaw-Table",
  name: "YaYaw Table",
  ogImageAlt: "YaYaw Table preview",
  title: "YaYaw Table",
  url: "https://table.yayaw.app",
} as const;

export function getSiteUrl(pathname = "/"): string {
  return new URL(pathname, siteConfig.url).toString();
}
