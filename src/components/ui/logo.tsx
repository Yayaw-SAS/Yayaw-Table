import { siteConfig } from "@/config/site-config";
import { cn } from "../../lib/utils";
import { SVG } from "../ui-custom/svg";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <SVG
      alt={`${siteConfig.name} logo`}
      className={cn(className)}
      src={siteConfig.logo}
    />
  );
}
