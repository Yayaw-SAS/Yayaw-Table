import { test } from "bun:test";
import {
  galleryAspectRatio,
  resolveGalleryMedia,
} from "../src/components/ui/yayaw-table/utils/media-contract";
import {
  attachMediaThumbnail,
  mediaViewerLabels,
  openMediaViewer,
} from "../src/components/ui/yayaw-table/utils/media-viewer";
import { tagAppearance } from "../src/components/ui/yayaw-table/utils/tag-colors";
import { galleryMediaSuite } from "./gallery-media-suite";

galleryMediaSuite(
  test,
  { galleryAspectRatio, resolveGalleryMedia },
  { attachMediaThumbnail, mediaViewerLabels, openMediaViewer },
  tagAppearance
);
