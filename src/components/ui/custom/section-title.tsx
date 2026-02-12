import type { ReactNode } from "react";

interface SectionTitleProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function SectionTitle({ title, description, icon }: SectionTitleProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {icon && <div className="text-primary">{icon}</div>}
        <h2>{title}</h2>
      </div>
      {description && (
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      )}
    </div>
  );
}
