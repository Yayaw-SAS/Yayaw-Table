import { it } from "vitest";
import { galleryMediaSuite } from "../../../tests/gallery-media-suite";
import { galleryAspectRatio, resolveGalleryMedia } from "./media-contract";
import {
  attachMediaThumbnail,
  mediaViewerLabels,
  openMediaViewer,
} from "./media-viewer";
import { tagAppearance } from "./tag-colors";

galleryMediaSuite(
  it,
  { galleryAspectRatio, resolveGalleryMedia },
  { attachMediaThumbnail, mediaViewerLabels, openMediaViewer },
  tagAppearance
);
