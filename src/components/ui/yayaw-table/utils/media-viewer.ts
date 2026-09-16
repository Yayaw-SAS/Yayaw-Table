import {
  type GalleryMediaItem,
  mediaUrl,
  type TableMediaSource,
} from "./media-contract";

export interface MediaViewerLabels {
  copyLink: string;
  linkCopied: string;
  preview: string;
  info: string;
  close: string;
  previous: string;
  next: string;
  fullscreen: string;
  openFile: string;
  unavailable: string;
}

export function mediaViewerLabels(locale: string): MediaViewerLabels {
  return locale.startsWith("fr")
    ? {
        copyLink: "Copier le lien",
        linkCopied: "Lien copié",
        preview: "Aperçu",
        info: "Infos",
        close: "Fermer",
        previous: "Précédent",
        next: "Suivant",
        fullscreen: "Plein écran",
        openFile: "Ouvrir le fichier",
        unavailable: "Aperçu indisponible pour ce fichier.",
      }
    : {
        copyLink: "Copy link",
        linkCopied: "Link copied",
        preview: "Preview",
        info: "Info",
        close: "Close",
        previous: "Previous",
        next: "Next",
        fullscreen: "Fullscreen",
        openFile: "Open file",
        unavailable: "Preview unavailable for this file.",
      };
}

function pauseMedia(root: HTMLElement): void {
  for (const media of root.querySelectorAll("video,audio")) {
    (media as HTMLMediaElement).pause();
  }
}

function nativeMedia(source: TableMediaSource, title: string): HTMLElement {
  if (source.type === "image") {
    const image = document.createElement("img");
    image.src = source.url;
    image.alt = source.alt ?? title;
    return image;
  }
  if (source.type === "video" || source.type === "audio") {
    const media = document.createElement(source.type);
    media.src = source.url;
    media.controls = true;
    media.preload = "metadata";
    media.setAttribute("aria-label", title);
    if (source.type === "video") {
      const video = media as HTMLVideoElement;
      video.playsInline = true;
      if (source.poster) {
        video.poster = source.poster;
      }
    }
    for (const track of source.tracks ?? []) {
      const element = document.createElement("track");
      element.src = track.src;
      element.kind = track.kind ?? "captions";
      element.label = track.label ?? "";
      element.srclang = track.srcLang ?? "";
      media.append(element);
    }
    return media;
  }
  if (source.type === "document" && source.mimeType === "application/pdf") {
    const frame = document.createElement("iframe");
    frame.src = source.url;
    frame.title = title;
    frame.referrerPolicy = "no-referrer";
    return frame;
  }
  return document.createElement("div");
}

/** One native, accessible viewer shared by both framework adapters. */
export function openMediaViewer({
  items,
  index,
  labels,
  onInfo,
  returnFocus,
}: {
  items: readonly GalleryMediaItem[];
  index: number;
  labels: MediaViewerLabels;
  onInfo?: (id: string) => void;
  returnFocus?: HTMLElement;
}): { destroy: () => void } {
  const dialog = document.createElement("dialog");
  dialog.className = "yayaw-media-viewer";
  // Portals inherit the originating table's theme, including scoped Vue themes.
  if (returnFocus) {
    const style = getComputedStyle(returnFocus);
    for (const token of [
      "background",
      "foreground",
      "muted",
      "border",
      "primary",
    ]) {
      const value =
        style.getPropertyValue(`--${token}`).trim() ||
        style.getPropertyValue(`--yayaw-${token}`).trim();
      if (value) {
        dialog.style.setProperty(`--${token}`, value);
      }
    }
  }
  dialog.setAttribute("aria-label", labels.preview);
  const header = document.createElement("header");
  const title = document.createElement("h2");
  const counter = document.createElement("span");
  counter.setAttribute("aria-live", "polite");
  const content = document.createElement("div");
  content.className = "yayaw-media-viewer-content";
  const footer = document.createElement("footer");
  let current = Math.max(0, Math.min(index, items.length - 1));
  let destroyed = false;
  const destroy = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    pauseMedia(dialog);
    dialog.close();
    dialog.remove();
    if (returnFocus?.isConnected) {
      returnFocus.focus({ preventScroll: true });
    }
  };
  const button = (label: string, action: () => void) => {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    control.addEventListener("click", action);
    return control;
  };
  const previous = button(labels.previous, () => show(current - 1));
  const next = button(labels.next, () => show(current + 1));
  const info = onInfo
    ? button(labels.info, () => {
        const id = items[current]?.id;
        destroy();
        if (id) {
          onInfo(id);
        }
      })
    : undefined;
  const full = button(labels.fullscreen, () => {
    if (document.fullscreenElement === dialog) {
      document.exitFullscreen?.().catch(() => undefined);
    } else {
      dialog.requestFullscreen?.().catch(() => undefined);
    }
  });
  full.hidden = typeof dialog.requestFullscreen !== "function";
  const close = button(labels.close, destroy);
  const link = document.createElement("a");
  link.textContent = labels.openFile;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const fallback = () => {
    pauseMedia(content);
    content.replaceChildren();
    const message = document.createElement("p");
    message.textContent = labels.unavailable;
    content.append(message);
  };
  function show(target: number): void {
    const item = items[target];
    if (!item) {
      return;
    }
    current = target;
    title.textContent = item.title;
    counter.textContent = `${current + 1} / ${items.length}`;
    previous.disabled = current === 0;
    next.disabled = current === items.length - 1;
    pauseMedia(content);
    content.replaceChildren();
    link.hidden = !mediaUrl(item.source?.url);
    if (!item.source || link.hidden) {
      fallback();
      return;
    }
    link.href = item.source.url;
    const media = nativeMedia(item.source, item.title);
    if (media.tagName === "DIV") {
      fallback();
    } else {
      media.addEventListener("error", fallback, { once: true });
      content.append(media);
    }
  }
  header.append(title, counter);
  if (info) {
    header.append(info);
  }
  header.append(full, close);
  footer.append(previous, link, next);
  dialog.append(header, content, footer);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    destroy();
  });
  dialog.addEventListener("close", destroy);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      destroy();
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if ((event.target as HTMLElement).closest("video,audio,input,textarea")) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(current - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(current + 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      show(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      show(items.length - 1);
    }
  });
  document.body.append(dialog);
  show(current);
  dialog.showModal();
  close.focus();
  return { destroy };
}

/** A muted hover sample never changes the full viewer's playback position. */
export function attachMediaThumbnail(
  host: HTMLElement,
  source: TableMediaSource | undefined,
  title: string,
  options: {
    fit: "cover" | "contain";
    hoverPreview?: boolean;
    previewLabel: string;
    onOpen: () => void;
  }
): () => void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "yayaw-media-thumbnail";
  button.setAttribute("aria-label", `${options.previewLabel}: ${title}`);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onOpen();
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let video: HTMLVideoElement | undefined;
  if (source?.type === "video") {
    video = document.createElement("video");
    video.src = source.url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    if (source.poster) {
      video.poster = source.poster;
    }
    video.style.objectFit = options.fit;
    video.setAttribute("aria-hidden", "true");
    button.append(video);
  } else if (source?.type === "image" || source?.poster) {
    const image = document.createElement("img");
    image.src = source.poster ?? source.url;
    image.alt = "";
    image.loading = "lazy";
    image.style.objectFit = options.fit;
    button.append(image);
  }
  const fallback = document.createElement("span");
  fallback.className = "yayaw-media-file";
  fallback.textContent =
    source?.type === "video"
      ? "▷"
      : (source?.mimeType?.split("/")[1]?.toUpperCase() ??
        source?.type?.toUpperCase() ??
        "—");
  fallback.setAttribute("aria-hidden", "true");
  if (button.firstChild) {
    button.firstChild.addEventListener(
      "error",
      () => button.replaceChildren(fallback),
      { once: true }
    );
  } else {
    button.append(fallback);
  }
  if (source?.type === "video" || source?.type === "audio") {
    const cue = document.createElement("span");
    cue.className = "yayaw-media-play-cue";
    cue.textContent = "▶";
    cue.setAttribute("aria-hidden", "true");
    button.append(cue);
  }
  const stop = () => {
    clearTimeout(timer);
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };
  const play = () => {
    if (
      !(video && options.hoverPreview) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    video.play().catch(() => undefined);
    clearTimeout(timer);
    timer = setTimeout(stop, 5000);
  };
  button.addEventListener("pointerenter", play);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("focus", play);
  button.addEventListener("blur", stop);
  host.replaceChildren(button);
  return () => {
    stop();
    host.replaceChildren();
  };
}
