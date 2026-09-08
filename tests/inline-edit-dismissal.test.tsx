import { afterEach, expect, it } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type InlineEditCommitResult,
  useInlineEditRuntime,
} from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";

const roots: { root: Root; container: HTMLElement }[] = [];
afterEach(async () => {
  for (const { root, container } of roots.splice(0)) {
    await act(() => root.unmount());
    container.remove();
  }
});
const deferred = () => {
  let resolve!: (result: InlineEditCommitResult) => void;
  const promise = new Promise<InlineEditCommitResult>((finish) => {
    resolve = finish;
  });
  return { resolve, promise };
};
async function setup(
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>,
  debounceMs = 0
) {
  let runtime!: ReturnType<typeof useInlineEditRuntime>;
  function Harness() {
    runtime = useInlineEditRuntime({
      initialValue: [1],
      editor: "multiSelect",
      debounceMs,
      onCommit,
    });
    return <output>{runtime.isEditing ? "editing" : "display"}</output>;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  await act(() => root.render(<Harness />));
  await act(() => runtime.startEditing());
  return () => runtime;
}

it.each([
  true,
  false,
])("waits for autosave before dismissing and preserves a failed draft (success=%s)", async (success) => {
  const gate = deferred();
  const calls: unknown[] = [];
  const runtime = await setup((value) => {
    calls.push(value);
    return gate.promise;
  });
  await act(() => runtime().updateDraftValue([2]));
  expect(runtime().isSaving).toBe(true);
  let close!: Promise<boolean>;
  await act(() => {
    close = runtime().commitAndClose();
  });
  expect(runtime().isEditing).toBe(true);
  await act(async () => {
    gate.resolve({ success, errorMessage: "Offline" });
    await close;
  });
  expect(runtime().isEditing).toBe(!success);
  expect(runtime().draftValue).toEqual([2]);
  expect(calls).toEqual([[2]]);
  if (!success) {
    expect(runtime().errorMessage).toBe("Offline");
  }
});

it("flushes the final selection even when change and dismissal share one event", async () => {
  const calls: unknown[] = [];
  const runtime = await setup((value) => {
    calls.push(value);
    return Promise.resolve({ success: true });
  }, 10_000);
  await act(async () => {
    runtime().updateDraftValue([]);
    await runtime().commitAndClose();
  });
  expect(calls).toEqual([[]]);
  expect(runtime().isEditing).toBe(false);
});

it("serializes a newer draft behind an in-flight write without overwriting or duplicating it", async () => {
  const first = deferred();
  const calls: unknown[] = [];
  const runtime = await setup((value) => {
    calls.push(value);
    return calls.length === 1
      ? first.promise
      : Promise.resolve({ success: true });
  });
  await act(() => runtime().updateDraftValue([2]));
  await act(() => runtime().updateDraftValue([2, false]));
  let close!: Promise<boolean>;
  await act(() => {
    close = runtime().commitAndClose();
    runtime().commitAndClose();
  });
  expect(calls).toEqual([[2]]);
  await act(async () => {
    first.resolve({ success: true });
    await close;
  });
  expect(calls).toEqual([[2], [2, false]]);
  expect(runtime().draftValue).toEqual([2, false]);
  expect(runtime().isEditing).toBe(false);
});

it("retains a rejected selection for retry and only closes after acknowledgement", async () => {
  let fail = true;
  const runtime = await setup(
    async () => ({ success: !fail, errorMessage: "Rejected" }),
    10_000
  );
  await act(async () => {
    runtime().updateDraftValue([2]);
    await runtime().commitAndClose();
  });
  expect(runtime().isEditing).toBe(true);
  expect(runtime().errorMessage).toBe("Rejected");
  fail = false;
  await act(async () => {
    await runtime().commitAndClose();
  });
  expect(runtime().isEditing).toBe(false);
  expect(runtime().errorMessage).toBeUndefined();
});

it("cancels unsaved selections and does not write on an unchanged dismissal", async () => {
  const calls: unknown[] = [];
  const runtime = await setup((value) => {
    calls.push(value);
    return Promise.resolve({ success: true });
  }, 10_000);
  await act(() => {
    runtime().updateDraftValue([2]);
    runtime().cancelEditing();
  });
  expect(runtime().draftValue).toEqual([1]);
  await act(async () => {
    runtime().startEditing();
    await runtime().commitAndClose();
  });
  expect(calls).toEqual([]);
});
