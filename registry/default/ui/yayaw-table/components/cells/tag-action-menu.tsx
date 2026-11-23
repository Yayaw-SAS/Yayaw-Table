"use client";

import { Menu } from "@base-ui/react/menu";
import {
  Fragment,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "../../providers/table-provider";
import {
  type ResolvedTagAction,
  tagActionMenuZIndex,
} from "../../utils/tag-items";
import { useDrawerFormPortalContainer } from "../forms/drawer-form-portal-context";

const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Tags and their portals must not activate rows, editors or drag sensors. */
export const tagInteractionProps = {
  onPointerDown: stop,
  onPointerUp: stop,
  onPointerMove: stop,
  onPointerCancel: stop,
  onMouseDown: stop,
  onMouseUp: stop,
  onClick: stop,
  onDoubleClick: stop,
  onContextMenu: stop,
  onKeyDown: stop,
  onKeyUp: stop,
  onDragStart: stop,
  onDragEnd: stop,
};

export function TagActionMenu({
  actions,
  onClick,
  badge,
}: {
  actions: ResolvedTagAction<ReactNode>[];
  onClick?: () => void;
  badge: ReactElement;
}) {
  const { t } = useTranslations();
  const [layer, setLayer] = useState({
    open: false,
    zIndex: 50,
    container: undefined as HTMLElement | undefined,
  });
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const drawerContainer = useDrawerFormPortalContainer();
  const selected = useRef(false);
  const press = useRef({
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    x: 0,
    y: 0,
    handled: false,
    touch: false,
  });
  const cancelPress = () => clearTimeout(press.current.timer);
  useEffect(() => {
    const current = press.current;
    return () => clearTimeout(current.timer);
  }, []);

  const setOpen = (open: boolean) => {
    if (open) {
      selected.current = false;
      const anchor = trigger.current;
      const drawer = drawerContainer?.current;
      setLayer({
        open,
        zIndex: tagActionMenuZIndex(anchor, 50),
        // Vaul's focus trap and native top-layer dialogs require an internal portal.
        container:
          anchor?.closest<HTMLElement>("dialog[open]") ??
          anchor?.closest<HTMLElement>("[data-vaul-drawer]") ??
          (anchor && drawer?.contains(anchor) ? drawer : undefined),
      });
    } else {
      setLayer((current) => ({ ...current, open }));
    }
  };
  const showMenu = () => setOpen(true);
  const activate = () => {
    if (onClick) {
      onClick();
    } else {
      showMenu();
    }
  };
  const runAction = async (action: ResolvedTagAction<ReactNode>) => {
    selected.current = true;
    setOpen(false);
    // Restore before running an action that may open its own dialog.
    trigger.current?.focus({ preventScroll: true });
    try {
      await action.run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open, details) => {
        if (details.reason === "escape-key") {
          // Escape can arrive before focus moves from the trigger into the popup.
          // Cancel native dialog dismissal wherever Base UI receives that key.
          details.event.preventDefault();
          details.event.stopPropagation();
        }
        setOpen(open);
      }}
      open={layer.open}
      triggerId={id}
    >
      <DropdownMenuTrigger
        {...tagInteractionProps}
        id={id}
        onClick={(event) => {
          stop(event);
          event.preventBaseUIHandler();
          if (press.current.handled) {
            press.current.handled = false;
            event.preventDefault();
            return;
          }
          activate();
        }}
        onContextMenu={(event) => {
          stop(event);
          event.preventDefault();
          cancelPress();
          if (press.current.touch) {
            press.current.handled = true;
          }
          showMenu();
        }}
        onKeyDown={(event) => {
          stop(event);
          const context =
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10");
          if (context || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.preventBaseUIHandler();
            if (context) {
              showMenu();
            } else {
              activate();
            }
          }
        }}
        onMouseDown={(event) => {
          stop(event);
          event.preventBaseUIHandler();
        }}
        onPointerCancel={(event) => {
          stop(event);
          cancelPress();
        }}
        onPointerDown={(event) => {
          stop(event);
          cancelPress();
          press.current.handled = false;
          press.current.touch = event.pointerType === "touch";
          if (press.current.touch) {
            press.current.x = event.clientX;
            press.current.y = event.clientY;
            press.current.timer = setTimeout(() => {
              press.current.handled = true;
              showMenu();
            }, 500);
          }
        }}
        onPointerLeave={(event) => {
          stop(event);
          cancelPress();
        }}
        onPointerMove={(event) => {
          stop(event);
          if (
            Math.hypot(
              event.clientX - press.current.x,
              event.clientY - press.current.y
            ) > 10
          ) {
            cancelPress();
          }
        }}
        onPointerUp={(event) => {
          stop(event);
          cancelPress();
        }}
        ref={trigger}
        render={badge}
      />
      <Menu.Portal container={layer.container}>
        <Menu.Positioner
          align="start"
          className="isolate outline-none"
          positionMethod={layer.container ? "absolute" : "fixed"}
          sideOffset={4}
          style={{ zIndex: layer.zIndex }}
        >
          <Menu.Popup
            {...tagInteractionProps}
            className="max-h-(--available-height) min-w-40 overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10"
            data-tag-menu=""
            finalFocus={() => (selected.current ? false : trigger.current)}
          >
            {actions.map((action, index) => (
              <Fragment key={action.id}>
                {action.destructive &&
                  index > 0 &&
                  !actions[index - 1]?.destructive && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={action.disabled}
                  onClick={(event) => {
                    stop(event);
                    event.preventBaseUIHandler();
                    if (action.disabled) {
                      return;
                    }
                    runAction(action);
                  }}
                  variant={action.destructive ? "destructive" : "default"}
                >
                  {action.icon}
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {action.label}
                  </span>
                </DropdownMenuItem>
              </Fragment>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </DropdownMenu>
  );
}
