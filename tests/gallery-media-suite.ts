import assert from "node:assert/strict";
import type * as Contract from "../src/components/ui/yayaw-table/utils/media-contract";
import type * as Viewer from "../src/components/ui/yayaw-table/utils/media-viewer";
import type { tagAppearance } from "../src/components/ui/yayaw-table/utils/tag-colors";

export function galleryMediaSuite(
  test: (name: string, run: () => void) => void,
  contract: Pick<typeof Contract, "resolveGalleryMedia" | "galleryAspectRatio">,
  viewer: Pick<
    typeof Viewer,
    "openMediaViewer" | "mediaViewerLabels" | "attachMediaThumbnail"
  >,
  appearance: typeof tagAppearance
) {
  test("requires media opt-in and rejects unsafe source, poster and caption URLs", () => {
    assert.equal(
      contract.resolveGalleryMedia({ url: "/photo.jpg" }),
      undefined
    );
    const config = { enabled: true, urlColumn: "url", mimeTypeColumn: "mime" };
    assert.equal(
      contract.resolveGalleryMedia({ url: "javascript:alert(1)" }, config),
      undefined
    );
    assert.deepEqual(
      contract.resolveGalleryMedia(
        { url: "/movie.mp4", mime: "video/mp4" },
        config
      )?.type,
      "video"
    );
    const media = contract.resolveGalleryMedia(
      {},
      {
        enabled: true,
        getMedia: () => ({
          url: "https://cdn.example/photo.jpg",
          poster: "data:image/svg+xml,unsafe",
          tracks: [{ src: "javascript:alert(1)" }, { src: "/captions.vtt" }],
        }),
      }
    );
    assert.equal(media?.poster, undefined);
    assert.deepEqual(media?.tracks, [{ src: "/captions.vtt" }]);
  });
  test("keeps medium proportions and scales preview height independently of card width", () => {
    assert.equal(contract.galleryAspectRatio("wide", "medium"), "1.6");
    assert.ok(Number(contract.galleryAspectRatio("square", "small")) > 1);
    assert.ok(Number(contract.galleryAspectRatio("square", "large")) < 1);
    assert.equal(contract.galleryAspectRatio("portrait"), "0.75");
  });
  test("supports neutral tags, explicit colors, and stable stored-value colors", () => {
    assert.deepEqual(appearance("active", false, { active: "bg-green-100" }), {
      colored: false,
    });
    assert.equal(
      appearance("active", true, { active: "bg-green-100" }).className,
      "bg-green-100"
    );
    assert.deepEqual(appearance("active"), appearance("ACTIVE"));
    assert.notDeepEqual(appearance("active"), appearance("draft"));
  });
  test("fills thumbnail bounds without distortion and separates preview activation", () => {
    const host = document.createElement("div");
    document.body.append(host);
    let opens = 0;
    const destroy = viewer.attachMediaThumbnail(
      host,
      { type: "image", url: "/portrait.jpg" },
      "Portrait",
      {
        fit: "cover",
        previewLabel: "Preview",
        onOpen: () => {
          opens += 1;
        },
      }
    );
    assert.equal(host.querySelector("img")?.style.objectFit, "cover");
    assert.equal(
      host.querySelector("button")?.getAttribute("aria-label"),
      "Preview: Portrait"
    );
    host.querySelector("button")?.click();
    assert.equal(opens, 1);
    destroy();
    assert.equal(host.childElementCount, 0);
    host.remove();
  });
  test("navigates the native viewer, opens the corresponding record, and restores focus", () => {
    const prototype = Object.getPrototypeOf(document.createElement("dialog"));
    const modal = prototype.showModal;
    const close = prototype.close;
    prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    prototype.close = function closeModal() {
      this.removeAttribute("open");
    };
    const trigger = document.createElement("button");
    document.body.append(trigger);
    let info = "";
    const instance = viewer.openMediaViewer({
      items: [
        {
          id: "one",
          title: "Landscape",
          source: { url: "/one.jpg", type: "image" },
        },
        {
          id: "two",
          title: "Archive",
          source: { url: "/two.zip", type: "file" },
        },
      ],
      index: 0,
      labels: viewer.mediaViewerLabels("fr"),
      returnFocus: trigger,
      onInfo: (id) => {
        info = id;
      },
    });
    try {
      const dialog = document.querySelector("dialog.yayaw-media-viewer");
      assert.ok(dialog);
      assert.equal(dialog.getAttribute("aria-label"), "Aperçu");
      assert.equal(dialog.querySelector("img")?.alt, "Landscape");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      assert.equal(dialog.querySelector("h2")?.textContent, "Archive");
      assert.equal(dialog.querySelector("a")?.getAttribute("href"), "/two.zip");
      const infoButton = [...dialog.querySelectorAll("button")].find(
        (button) => button.textContent === "Infos"
      );
      assert.ok(infoButton);
      infoButton.click();
      assert.equal(info, "two");
      assert.equal(document.querySelector("dialog.yayaw-media-viewer"), null);
      assert.equal(document.activeElement, trigger);
    } finally {
      instance.destroy();
      trigger.remove();
      prototype.showModal = modal;
      prototype.close = close;
    }
  });
}
