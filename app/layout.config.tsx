import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const baseOptions: BaseLayoutProps = {
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
