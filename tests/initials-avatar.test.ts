import { it } from "bun:test";
import { normalizeGalleryViewConfig } from "../src/components/ui/yayaw-table/utils/gallery-view-state";
import {
  avatarHue,
  avatarInitials,
  avatarNameOf,
  initialsAvatar,
  normalizeAvatarOption,
  resolveAvatarConfig,
} from "../src/components/ui/yayaw-table/utils/initials-avatar";
import { normalizeListViewConfig } from "../src/components/ui/yayaw-table/utils/list-view";
import { initialsAvatarSuite } from "./initials-avatar-suite";

initialsAvatarSuite(
  it,
  {
    avatarHue,
    avatarInitials,
    avatarNameOf,
    initialsAvatar,
    normalizeAvatarOption,
    resolveAvatarConfig,
  },
  { normalizeGalleryViewConfig, normalizeListViewConfig }
);
