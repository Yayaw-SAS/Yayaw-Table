import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import {
  DependencyInstallTabs,
  RegistryInstallTabs,
} from "@/src/components/site/package-manager-tabs";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    DependencyInstallTabs,
    RegistryInstallTabs,
    ...components,
  };
}
