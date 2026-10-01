import { afterEach, expect, it, mock } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { KanbanCard, KanbanProvider } from "../src/components/ui/custom/kanban";

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

const mountCard = (dragFromCard: boolean) => {
  const onDragStart = mock();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <KanbanProvider
        columns={[{ id: "open", name: "Open" }]}
        data={[{ column: "open", id: "one", name: "Alpha" }]}
        onDragStart={onDragStart}
      >
        {() => (
          <KanbanCard
            column="open"
            dragFromCard={dragFromCard}
            dragHandle={({ attributes, listeners, setActivatorNodeRef }) => (
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                {...listeners}
              >
                Handle
              </button>
            )}
            id="one"
            itemAttributes={{ "data-row-id": "one" }}
            key="one"
            name="Alpha"
          >
            <p data-testid="body">Alpha</p>
            <button data-testid="control" type="button">
              Menu
            </button>
          </KanbanCard>
        )}
      </KanbanProvider>
    );
  });
  const card = container.querySelector("[data-row-id]") as HTMLElement;
  // Presses an element, then moves past the 8px activation distance.
  const drag = (testId: string) => {
    const target = card.querySelector(`[data-testid="${testId}"]`);
    act(() => {
      target?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 0 })
      );
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
  };
  return { card, drag, onDragStart };
};

it("starts a drag from the card body with dragFromCard", () => {
  const { card, drag, onDragStart } = mountCard(true);
  // The handle keeps the drag role, focus and keyboard activation.
  expect(card.getAttribute("role")).toBeNull();
  expect(card.getAttribute("tabindex")).toBeNull();
  expect(card.getAttribute("aria-roledescription")).toBeNull();
  drag("control");
  expect(onDragStart).not.toHaveBeenCalled();
  drag("body");
  expect(onDragStart).toHaveBeenCalledTimes(1);
});

it("drags only from the handle without dragFromCard", () => {
  const { drag, onDragStart } = mountCard(false);
  drag("body");
  expect(onDragStart).not.toHaveBeenCalled();
});
