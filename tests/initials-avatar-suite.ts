import assert from "node:assert/strict";
import type * as GalleryViewState from "../src/components/ui/yayaw-table/utils/gallery-view-state";
import type * as InitialsAvatar from "../src/components/ui/yayaw-table/utils/initials-avatar";
import type * as ListView from "../src/components/ui/yayaw-table/utils/list-view";

/** Generated avatars, shared by the React and Vue editions. */
export function initialsAvatarSuite(
  test: (name: string, run: () => void) => void,
  avatar: Pick<
    typeof InitialsAvatar,
    | "avatarHue"
    | "avatarInitials"
    | "avatarNameOf"
    | "avatarStack"
    | "initialsAvatar"
    | "normalizeAvatarOption"
    | "resolveAvatarConfig"
  >,
  settings: Pick<typeof GalleryViewState, "normalizeGalleryViewConfig"> &
    Pick<typeof ListView, "normalizeListViewConfig">
) {
  test("reads initials from names, single words and emails", () => {
    assert.equal(avatar.avatarInitials("Ada Lovelace"), "AL");
    assert.equal(avatar.avatarInitials("  grace  brewster hopper "), "GH");
    assert.equal(avatar.avatarInitials("Acme"), "AC");
    assert.equal(avatar.avatarInitials("jean-luc.picard@example.com"), "JP");
    assert.equal(avatar.avatarInitials("Élodie Ömer"), "ÉÖ");
    assert.equal(avatar.avatarInitials("  "), "");
    assert.equal(avatar.avatarInitials("— !"), "");
  });

  test("derives the same color from the same name", () => {
    assert.equal(
      avatar.avatarHue("Ada Lovelace"),
      avatar.avatarHue("ada lovelace ")
    );
    const hues = new Set(
      ["Ada", "Grace", "Linus", "Margaret", "Alan", "Barbara"].map((name) =>
        avatar.avatarHue(name)
      )
    );
    assert.ok(hues.size > 1);
    assert.deepEqual(avatar.initialsAvatar("Ada Lovelace", "square"), {
      initials: "AL",
      name: "Ada Lovelace",
      hue: avatar.avatarHue("Ada Lovelace"),
      shape: "square",
      style: { "--yayaw-avatar-hue": String(avatar.avatarHue("Ada Lovelace")) },
    });
    assert.equal(avatar.initialsAvatar("?"), undefined);
  });

  test("resolves the avatar option of columns and card modes", () => {
    assert.deepEqual(avatar.resolveAvatarConfig(true), {});
    assert.equal(avatar.resolveAvatarConfig(false), undefined);
    assert.equal(avatar.resolveAvatarConfig(undefined), undefined);
    assert.deepEqual(
      avatar.resolveAvatarConfig({
        nameColumn: " owner ",
        imageColumn: "photo",
        shape: "oval",
      }),
      { nameColumn: "owner", imageColumn: "photo" }
    );
    assert.equal(avatar.normalizeAvatarOption(false), false);
    assert.equal(avatar.normalizeAvatarOption("yes"), undefined);
  });

  test("reads a record's name from a column or the usual keys", () => {
    assert.equal(avatar.avatarNameOf({ title: "Deal", name: "" }), "Deal");
    assert.equal(
      avatar.avatarNameOf({ name: "Acme", owner: "Ada" }, "owner"),
      "Ada"
    );
    assert.equal(avatar.avatarNameOf({ id: 3 }), "");
  });

  test("gallery and list settings keep the avatar option", () => {
    assert.deepEqual(
      settings.normalizeGalleryViewConfig({
        avatar: { nameColumn: "name" },
      }),
      { avatar: { nameColumn: "name" } }
    );
    assert.deepEqual(
      settings.normalizeListViewConfig({
        avatar: { imageColumn: "photo", shape: "square" },
      }),
      { avatar: { imageColumn: "photo", shape: "square" } }
    );
    assert.deepEqual(settings.normalizeListViewConfig({ avatar: true }), {
      avatar: true,
    });
  });

  test("a people stack shows up to four, else three and the rest behind +N", () => {
    const people = ["A", "B", "C", "D", "E", "F"];
    assert.deepEqual(avatar.avatarStack(people.slice(0, 4)), {
      shown: ["A", "B", "C", "D"],
      hidden: [],
    });
    assert.deepEqual(avatar.avatarStack(people), {
      shown: ["A", "B", "C"],
      hidden: ["D", "E", "F"],
    });
    assert.deepEqual(avatar.avatarStack(people, 2), {
      shown: ["A"],
      hidden: ["B", "C", "D", "E", "F"],
    });
  });
}
