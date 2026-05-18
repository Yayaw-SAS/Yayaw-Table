import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { siteConfig } from "@/src/lib/site-config";

export const baseOptions: BaseLayoutProps = {
  githubUrl: siteConfig.githubUrl,
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        <Image
          alt="YaYaw Table"
          className="block dark:hidden"
          height={24}
          src="/yayaw-icon-light.svg"
          width={24}
        />
        <Image
          alt="YaYaw Table"
          className="hidden dark:block"
          height={24}
          src="/yayaw-icon-dark.svg"
          width={24}
        />
        <span className="font-semibold">YaYaw Table</span>
      </span>
    ),
  },
};
