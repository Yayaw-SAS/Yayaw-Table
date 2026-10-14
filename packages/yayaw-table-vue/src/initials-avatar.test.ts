import { it } from "vitest";
import { initialsAvatarSuite } from "../../../tests/initials-avatar-suite";
import { normalizeGalleryViewConfig } from "./gallery-view-state";
import {
  avatarHue,
  avatarInitials,
  avatarNameOf,
  avatarStack,
  initialsAvatar,
  normalizeAvatarOption,
  resolveAvatarConfig,
} from "./initials-avatar";
import { normalizeListViewConfig } from "./list-view";

initialsAvatarSuite(
  it,
  {
    avatarHue,
    avatarInitials,
    avatarNameOf,
    avatarStack,
    initialsAvatar,
    normalizeAvatarOption,
    resolveAvatarConfig,
  },
  { normalizeGalleryViewConfig, normalizeListViewConfig }
);
