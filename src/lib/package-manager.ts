export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface PackageManagerCommands {
  bun: string;
  npm: string;
  pnpm: string;
  yarn: string;
}

export const DEFAULT_PACKAGE_MANAGER: PackageManager = "npm";

export const PACKAGE_MANAGER_STORAGE_KEY = "yayaw-package-manager";

export const LATEST_REGISTRY_URL = "https://table.yayaw.eu/r/yayaw-table.json";

export const isPackageManager = (
  value: string | null | undefined
): value is PackageManager => {
  return PACKAGE_MANAGERS.includes(value as PackageManager);
};

export const createShadcnAddCommands = (
  target: string
): PackageManagerCommands => {
  return {
    bun: `bunx --bun shadcn@latest add ${target}`,
    npm: `npx shadcn@latest add ${target}`,
    pnpm: `pnpm dlx shadcn@latest add ${target}`,
    yarn: `yarn dlx shadcn@latest add ${target}`,
  };
};

export const createPackageInstallCommands = (
  dependency: string
): PackageManagerCommands => {
  return {
    bun: `bun add ${dependency}`,
    npm: `npm install ${dependency}`,
    pnpm: `pnpm add ${dependency}`,
    yarn: `yarn add ${dependency}`,
  };
};

export const LATEST_INSTALL_COMMANDS =
  createShadcnAddCommands(LATEST_REGISTRY_URL);
