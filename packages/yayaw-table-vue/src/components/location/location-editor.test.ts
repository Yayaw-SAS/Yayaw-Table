import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, reactive, ref } from "vue";
import YayawTableForm from "../../form/YayawTableForm.vue";
import type { FormDraft } from "../../form-view";
import LocationEditor from "./LocationEditor.vue";

const PARIS = { lat: 48.8566, lng: 2.3522 };
const mounted: VueWrapper[] = [];
beforeEach(() => {
  // JSDOM omits CSS.escape; these fixtures use plain identifier keys.
  vi.stubGlobal("CSS", { escape: (value: string) => value });
});
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
const track = <T extends VueWrapper>(wrapper: T): T => {
  mounted.push(wrapper);
  return wrapper;
};
const button = (wrapper: VueWrapper, text: string) => {
  const found = wrapper.findAll("button").find((item) => item.text() === text);
  if (!found) {
    throw new Error(`Missing button: ${text}`);
  }
  return found;
};

describe("location drafts", () => {
  it.each([
    "en",
    "fr",
  ])("blocks Done, Enter and blur for invalid visible coordinates (%s)", async (locale) => {
    const wrapper = track(
      mount(LocationEditor, {
        props: { value: PARIS, inputId: "site", actions: true, locale },
        attachTo: document.body,
      })
    );
    const latitude = wrapper.get<HTMLInputElement>("#site-lat");
    await latitude.setValue("91");
    expect(wrapper.emitted("invalid-draft")?.at(-1)?.[0]).toEqual({
      lat: "91",
      lng: "2.3522",
      label: "",
      address: "",
    });
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(latitude.attributes("aria-invalid")).toBe("true");
    await button(wrapper, locale === "fr" ? "Terminé" : "Done").trigger(
      "click"
    );
    await latitude.trigger("keydown", { key: "Enter" });
    await latitude.trigger("focusout", { relatedTarget: document.body });
    expect(wrapper.emitted("done")).toBeUndefined();
    expect(wrapper.emitted("leave")).toBeUndefined();
    expect(wrapper.emitted("change")).toBeUndefined();
    await latitude.setValue("49");
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toEqual({
      lat: 49,
      lng: 2.3522,
    });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await latitude.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("done")).toHaveLength(1);
    await latitude.trigger("focusout", { relatedTarget: document.body });
    expect(wrapper.emitted("leave")).toHaveLength(1);
  });

  it("normalizes typed coordinate pairs before subsequent coordinate edits", async () => {
    const wrapper = track(
      mount(LocationEditor, {
        props: { value: null, inputId: "site" },
      })
    );
    await wrapper.get("#site").setValue("48.8566, 2.3522");
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe(
      "48.8566"
    );
    expect(wrapper.get<HTMLInputElement>("#site-lng").element.value).toBe(
      "2.3522"
    );
    expect(wrapper.get<HTMLInputElement>("#site").element.value).toBe(
      "48.8566, 2.3522"
    );
    await wrapper.get("#site-lat").setValue("91");
    expect(wrapper.get<HTMLInputElement>("#site").element.value).toBe("");
    expect(wrapper.emitted("change")).toHaveLength(1);
    expect(wrapper.emitted("invalid-draft")?.at(-1)?.[0]).toMatchObject({
      lat: "91",
    });
  });

  it("keeps every typed coordinate character through controlled echoes and saves the complete position", async () => {
    const value = ref<unknown>(null);
    const changed = vi.fn((next: unknown) => {
      value.value = next;
    });
    const wrapper = track(
      mount(
        defineComponent({
          setup: () => () =>
            h(LocationEditor, {
              value: value.value,
              inputId: "site",
              onChange: changed,
              "onInvalid-draft": (next: unknown) => {
                value.value = next;
              },
            }),
        })
      )
    );
    const address = wrapper.get<HTMLInputElement>("#site");
    const coordinates = "48.8566, 2.3522";
    let typed = "";
    for (const character of coordinates) {
      typed += character;
      await address.setValue(address.element.value + character);
      expect(address.element.value).toBe(typed);
    }
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe(
      "48.8566"
    );
    expect(wrapper.get<HTMLInputElement>("#site-lng").element.value).toBe(
      "2.3522"
    );
    expect(changed).toHaveBeenLastCalledWith(PARIS);
    await address.trigger("focusout", { relatedTarget: document.body });
    expect(address.element.value).toBe("");
    expect(value.value).toEqual(PARIS);
  });

  it("preserves an ordinary postal address when coordinates change", async () => {
    const wrapper = track(
      mount(LocationEditor, {
        props: {
          value: { ...PARIS, address: "10 Rue de Rivoli, Paris" },
          inputId: "site",
        },
      })
    );
    await wrapper.get("#site-lat").setValue("49");
    await wrapper.get("#site-lng").setValue("3");
    expect(wrapper.get<HTMLInputElement>("#site").element.value).toBe(
      "10 Rue de Rivoli, Paris"
    );
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toEqual({
      lat: 49,
      lng: 3,
      address: "10 Rue de Rivoli, Paris",
    });
  });

  it("rejects edits over a stored coordinate-like address and restores invalid drafts", async () => {
    const wrapper = track(
      mount(LocationEditor, {
        props: {
          value: { ...PARIS, address: "48.8566, 2.3522" },
          inputId: "site",
        },
      })
    );
    expect(wrapper.get<HTMLInputElement>("#site").element.value).toBe("");
    await wrapper.get("#site-lat").setValue("91");
    expect(wrapper.emitted("change")).toBeUndefined();
    await wrapper.get("#site-lat").setValue("");
    expect(wrapper.emitted("change")).toBeUndefined();
    const invalid = { label: "Draft", address: "", lat: "bad", lng: "2" };
    await wrapper.setProps({ value: JSON.stringify(invalid) });
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe(
      "bad"
    );
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    const restored = track(
      mount(LocationEditor, { props: { value: invalid, inputId: "restored" } })
    );
    expect(restored.get<HTMLInputElement>("#restored-lat").element.value).toBe(
      "bad"
    );
    expect(restored.find('[role="alert"]').exists()).toBe(true);
  });

  it("preserves its own formatted echoes but follows external resets in either direction", async () => {
    const wrapper = track(
      mount(LocationEditor, {
        props: { value: PARIS, inputId: "site" },
      })
    );
    await wrapper.get("#site-lng").setValue("2.");
    await wrapper.setProps({ value: { ...PARIS, lng: 2 } });
    expect(wrapper.get<HTMLInputElement>("#site-lng").element.value).toBe("2.");
    await wrapper.setProps({ value: { lat: 10, lng: 20 } });
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe("10");
    await wrapper.setProps({ value: { ...PARIS, lng: 2 } });
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe(
      "48.8566"
    );
    await wrapper.get("#site-lat").setValue("91");
    await wrapper.setProps({ value: null });
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe("");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("follows an external update that keeps the same reactive value object", async () => {
    const value = reactive({
      label: "",
      address: "",
      lat: "48.8566",
      lng: "2.3522",
    });
    const wrapper = track(
      mount(LocationEditor, { props: { value, inputId: "site" } })
    );
    value.lat = "91";
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe("91");
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    value.lat = "49";
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>("#site-lat").element.value).toBe("49");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});

describe("public location forms", () => {
  const publicForm = (
    layout: "page" | "steps",
    required: boolean,
    initial = true
  ) => {
    const draft = ref<FormDraft>(
      initial ? { site: JSON.stringify(PARIS) } : {}
    );
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    const wrapper = track(
      mount(
        defineComponent({
          setup: () => () =>
            h(YayawTableForm, {
              columns: [{ id: "site", header: "Site", type: "location" }],
              form: {
                layout,
                questions: [{ id: "site", columnId: "site", required }],
                submitLabel: "Save location",
              },
              value: draft.value,
              "onUpdate:value": (value: FormDraft) => {
                draft.value = value;
              },
              onSubmit,
            }),
        }),
        { attachTo: document.body }
      )
    );
    return { wrapper, onSubmit, draft };
  };
  const submit = async (wrapper: VueWrapper, layout: "page" | "steps") => {
    if (layout === "page") {
      await wrapper.get("form").trigger("submit");
    } else {
      await button(wrapper, "Save location").trigger("click");
    }
    await flushPromises();
  };

  it.each([
    "page",
    "steps",
  ] as const)("rejects invalid and incomplete drafts, then accepts correction (%s)", async (layout) => {
    const { wrapper, onSubmit, draft } = publicForm(layout, false);
    const latitude = wrapper.get<HTMLInputElement>('input[id$="-lat"]');
    await latitude.setValue("91");
    await submit(wrapper, layout);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(String(draft.value.site)).toContain('"91"');
    expect(latitude.element.value).toBe("91");
    await latitude.setValue("");
    await submit(wrapper, layout);
    expect(onSubmit).not.toHaveBeenCalled();
    await latitude.setValue("49");
    await submit(wrapper, layout);
    expect(onSubmit).toHaveBeenCalledWith(
      { site: { lat: 49, lng: 2.3522 } },
      expect.anything()
    );
  });

  it.each([
    false,
    true,
  ])("clearing respects required=%s instead of retaining a prior location", async (required) => {
    const { wrapper, onSubmit } = publicForm("page", required);
    await wrapper.get('input[id$="-lat"]').setValue("91");
    await button(wrapper, "Clear").trigger("click");
    await submit(wrapper, "page");
    if (required) {
      expect(onSubmit).not.toHaveBeenCalled();
    } else {
      expect(onSubmit).toHaveBeenCalledWith({}, expect.anything());
    }
  });

  it("does not submit a partially entered new location", async () => {
    const { wrapper, onSubmit } = publicForm("page", false, false);
    await wrapper.get('input[id$="-lat"]').setValue("48.8566");
    await submit(wrapper, "page");
    expect(onSubmit).not.toHaveBeenCalled();
    await wrapper.get('input[id$="-lng"]').setValue("2.3522");
    await submit(wrapper, "page");
    expect(onSubmit).toHaveBeenCalledWith({ site: PARIS }, expect.anything());
  });
});
