import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  type PropType,
} from "vue";
import {
  ATTENTION_ITEMS,
  attentionItemLabel,
  attentionItems,
  attentionSettingsLegend,
  attentionViews,
  type ScreenHost,
  type ScreenShortcut,
  screenAttention,
  screenText,
  toggleAttentionItem,
} from "../../../examples/screen";
import type {
  DashboardFilterValue,
  DashboardOpenViewContext,
} from "../src/dashboard/dashboard-model";
import type {
  DashboardInlineView,
  DashboardJsonObject,
} from "../src/dashboard/dashboard-schema";
import type { DashboardTableSource } from "../src/dashboard/dashboard-types";

/** The demo host (its rows), for the blocks. */
export const screenHostKey: InjectionKey<ScreenHost<DashboardTableSource>> =
  Symbol("screen-host");

/** What every block receives (`DashboardBlockProps`). */
const blockProps = {
  widgetId: { type: String, required: true },
  props: { type: Object as PropType<DashboardJsonObject>, required: true },
  size: Object as PropType<{ w: number; h: number }>,
  editing: Boolean,
  locale: { type: String, required: true },
  revision: { type: Number, required: true },
  filters: {
    type: Object as PropType<
      Readonly<Record<string, DashboardFilterValue | undefined>>
    >,
    required: true,
  },
  refresh: Function as PropType<(tableId?: string) => void>,
  openView: Function as PropType<
    (
      tableId: string,
      viewId: string | null,
      context?: DashboardOpenViewContext
    ) => void
  >,
} as const;

/** Links to frequent tasks; nothing without links. */
export const ShortcutsBlock = defineComponent({
  name: "ShortcutsBlock",
  props: blockProps,
  setup(props) {
    return () => {
      const links = Array.isArray(props.props.links)
        ? (props.props.links as unknown as ScreenShortcut[])
        : [];
      if (!links.length) {
        return null;
      }
      return h(
        "ul",
        { class: "screen-block-list", "data-shortcuts": "" },
        links.map((link) =>
          h("li", { key: link.href }, [
            h(
              "a",
              { class: "screen-block-link", href: link.href },
              screenText(link.label, props.locale)
            ),
          ])
        )
      );
    };
  },
});

/**
 * What needs attention under the screen's filters, read again with each
 * revision (after changes and "Refresh all"); nothing when all is done.
 */
export const AttentionBlock = defineComponent({
  name: "AttentionBlock",
  props: blockProps,
  setup(props) {
    const host = inject(screenHostKey);
    return () => {
      const items = host
        ? screenAttention(
            host,
            props.filters,
            props.locale,
            attentionItems(props.props)
          )
        : [];
      if (!items.length) {
        return null;
      }
      return h(
        "ul",
        { class: "screen-block-list", "data-attention": "" },
        items.map((item) =>
          h("li", { key: item.id }, [
            h(
              "button",
              {
                class: "screen-block-link",
                type: "button",
                "data-attention-item": item.id,
                onClick: () => {
                  const target = attentionViews[item.id];
                  props.openView?.(target.tableId, null, {
                    view: target.view as DashboardInlineView,
                  });
                },
              },
              item.text
            ),
          ])
        )
      );
    };
  },
});

/** The `attention` block's settings in the screen editor: the items it lists. */
export const AttentionSettings = defineComponent({
  name: "AttentionSettings",
  props: {
    widgetId: { type: String, required: true },
    props: { type: Object as PropType<DashboardJsonObject>, required: true },
    locale: { type: String, required: true },
    onChange: {
      type: Function as PropType<(props: DashboardJsonObject) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const listed = attentionItems(props.props);
      return h(
        "fieldset",
        { class: "screen-block-settings", "data-attention-settings": "" },
        [
          h("legend", attentionSettingsLegend(props.locale)),
          ...ATTENTION_ITEMS.map((id) =>
            h("label", { key: id }, [
              h("input", {
                type: "checkbox",
                checked: listed.includes(id),
                onChange: (event: Event) =>
                  props.onChange(
                    toggleAttentionItem(
                      props.props,
                      id,
                      (event.target as HTMLInputElement).checked
                    ) as DashboardJsonObject
                  ),
              }),
              attentionItemLabel(id, props.locale),
            ])
          ),
        ]
      );
    };
  },
});
