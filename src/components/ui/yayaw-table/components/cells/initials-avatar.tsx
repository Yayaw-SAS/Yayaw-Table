"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  type AvatarShape,
  initialsAvatar,
} from "../../utils/initials-avatar";
import "../../utils/initials-avatar.css";

/** A card's avatar: its image, else initials of its name. */
export interface CardAvatar {
  name: string;
  shape?: AvatarShape;
  source?: string;
}

export type InitialsAvatarSize = "cell" | "large" | "small";

interface InitialsAvatarProps {
  className?: string;
  /**
   * The name is shown next to the avatar: the initials are hidden from
   * assistive technologies. Otherwise the avatar reads as the name.
   */
  decorative?: boolean;
  name: string;
  shape?: AvatarShape;
  size?: InitialsAvatarSize;
}

/** Initials on a stable color derived from the name; nothing without letters. */
export function InitialsAvatar({
  className,
  decorative = false,
  name,
  shape = "circle",
  size = "small",
}: InitialsAvatarProps) {
  const avatar = initialsAvatar(name, shape);
  if (!avatar) {
    return null;
  }
  const label = decorative
    ? { "aria-hidden": true as const }
    : { "aria-label": avatar.name, role: "img" as const };
  return (
    <span
      className={cn("yayaw-avatar", className)}
      data-avatar=""
      data-shape={avatar.shape}
      data-size={size === "small" ? undefined : size}
      style={avatar.style}
      {...label}
    >
      {avatar.initials}
    </span>
  );
}

/**
 * A card's avatar: the record's image when it loads, else its initials. The
 * card shows the name beside it, so both stay decorative.
 */
export function RecordAvatar({
  className,
  name,
  shape = "circle",
  source,
}: {
  className?: string;
  name: string;
  shape?: AvatarShape;
  source?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (source && failedSource !== source) {
    return (
      <span
        className={cn("yayaw-avatar", className)}
        data-avatar=""
        data-shape={shape}
      >
        {/* biome-ignore lint/performance/noImgElement: registry consumers should not need Next.js image domain configuration. */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps broken media to the initials. */}
        <img
          alt=""
          height={28}
          loading="lazy"
          onError={() => setFailedSource(source)}
          src={source}
          width={28}
        />
      </span>
    );
  }
  return (
    <InitialsAvatar
      className={className}
      decorative
      name={name}
      shape={shape}
    />
  );
}
