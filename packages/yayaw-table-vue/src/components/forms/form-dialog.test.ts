import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { h } from "vue";
import FormDialog from "./FormDialog.vue";

enableAutoUnmount(afterEach);

it("keeps the form attached across dialog renders, so its scroll position survives", async () => {
  const dialog = mount(FormDialog, {
    attachTo: document.body,
    props: { open: true, title: "Record", presentation: "drawer" },
    slots: {
      default: () => h("div", { class: "yayaw-record-body" }, "Fields"),
    },
  });
  await flushPromises();
  const body = document.querySelector<HTMLElement>(".yayaw-record-body");
  expect(body).not.toBeNull();
  const moves: MutationRecord[] = [];
  const observer = new MutationObserver((records) => moves.push(...records));
  observer.observe(document.body, { childList: true, subtree: true });

  // A dropdown opening in the form re-renders the dialog, as a busy change does.
  await dialog.setProps({ busy: true });
  await dialog.setProps({ busy: false });
  await flushPromises();
  observer.disconnect();

  expect(
    moves.filter((record) =>
      [...record.removedNodes].some((node) => node.contains(body))
    )
  ).toEqual([]);
  expect(body?.isConnected).toBe(true);
});
