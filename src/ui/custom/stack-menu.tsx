"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  Children,
  createContext,
  forwardRef,
  type HTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Button } from "@/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { cn } from "../../lib/utils";

interface StackMenuViewProps {
  children: ReactNode;
  name: string;
  title?: string;
}

const StackMenuContext = createContext<{
  activeView: string;
  navigate: (view: string, title?: string) => void;
  goBack: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  defaultView: string;
  viewHistory: Array<{ name: string; title?: string }>;
  canGoBack: boolean;
}>({
  activeView: "main",
  navigate: () => {
    // Default empty navigation handler
  },
  goBack: () => {
    // Default empty go back handler
  },
  onOpenChange: undefined,
  open: false,
  defaultView: "main",
  viewHistory: [],
  canGoBack: false,
});

const useStackMenu = () => {
  return useContext(StackMenuContext);
};

const stackMenuVariants = cva("flex flex-col", {
  variants: {
    // When framed=true, the menu renders its own rounded/bordered frame.
    // When framed=false (inside a dropdown), we avoid duplicate borders/radius.
    framed: {
      true: "rounded-lg border bg-background shadow-lg",
      false: "",
    },
    variant: {
      // Variant classes are attached via compoundVariants only when framed=true
      default: "",
      ghost: "",
    },
    size: {
      default: "max-h-[500px] w-[320px]",
      sm: "max-h-[400px] w-[280px]",
      lg: "max-h-[600px] w-[400px]",
    },
  },
  compoundVariants: [
    {
      framed: true,
      variant: "default",
      class: "border-border bg-popover",
    },
    {
      framed: true,
      variant: "ghost",
      class: "border-muted bg-background",
    },
  ],
  defaultVariants: {
    framed: true,
    variant: "default",
    size: "default",
  },
});

interface StackMenuProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackMenuVariants> {
  defaultView?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  asDropdown?: boolean;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Optional content rendered in the header, before the close button (e.g. Reset all) */
  headerEndContent?: ReactNode;
}

const StackMenuView = ({ children, name }: StackMenuViewProps) => {
  return (
    <div className="flex h-full w-full flex-col" data-view-name={name}>
      {children}
    </div>
  );
};
StackMenuView.displayName = "StackMenuView";

const StackMenu = forwardRef<HTMLDivElement, StackMenuProps>(
  (
    {
      className,
      variant,
      size,
      defaultView = "main",
      children,
      open,
      onOpenChange,
      trigger,
      asDropdown = false,
      align = "end",
      sideOffset = 5,
      headerEndContent,
      ...props
    },
    ref
  ) => {
    const [activeView, setActiveView] = useState(defaultView);
    const [viewHistory, setViewHistory] = useState<
      Array<{ name: string; title?: string }>
    >([{ name: defaultView }]);
    const [isOpen, setIsOpen] = useState(open);

    const navigate = useCallback((view: string, title?: string) => {
      setActiveView(view);
      setViewHistory((prev) => [...prev, { name: view, title }]);
    }, []);

    const goBack = useCallback(() => {
      if (viewHistory.length > 1) {
        const newHistory = [...viewHistory];
        newHistory.pop();
        const previousView = newHistory.at(-1);
        if (previousView) {
          setActiveView(previousView.name);
        }
        setViewHistory(newHistory);
      }
    }, [viewHistory]);

    const canGoBack = viewHistory.length > 1;

    const handleOpenChange = useCallback(
      (state: boolean) => {
        setIsOpen(state);
        onOpenChange?.(state);

        if (!state) {
          // Reset to default view when closing
          setActiveView(defaultView);
          setViewHistory([{ name: defaultView }]);
        }
      },
      [defaultView, onOpenChange]
    );

    useEffect(() => {
      if (open !== undefined && open !== isOpen) {
        setIsOpen(open);
      }
    }, [open, isOpen]);

    // Get all views
    const viewChildren = Children.toArray(children).filter(
      (child) =>
        isValidElement(child) &&
        typeof child.type === "function" &&
        (child.type as { displayName?: string }).displayName === "StackMenuView"
    );

    // Find the active view
    const activeViewChild = viewChildren.find((child) => {
      if (isValidElement(child)) {
        const childProps = child.props as StackMenuViewProps;
        return childProps.name === activeView;
      }
      return false;
    });

    // Get current view title
    const currentViewTitle = viewHistory.at(-1)?.title;

    const menuContent = (
      <StackMenuContext.Provider
        value={{
          activeView,
          navigate,
          goBack,
          open: isOpen,
          onOpenChange: handleOpenChange,
          defaultView,
          viewHistory,
          canGoBack,
        }}
      >
        <div
          className={cn(
            stackMenuVariants({ variant, size, framed: !asDropdown }),
            className
          )}
          ref={ref}
          {...props}
        >
          {/* Header with navigation */}
          <div className="flex items-center gap-1 border-border border-b bg-muted/30 px-3 py-2">
            {canGoBack && (
              <Button
                aria-label="Back"
                className="h-8 w-8 shrink-0 p-0 hover:bg-muted"
                onClick={goBack}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
              {currentViewTitle ||
                (activeView === defaultView ? "Menu" : activeView)}
            </div>
            {headerEndContent}
            {onOpenChange && (
              <Button
                aria-label="Close"
                className="h-8 w-8 shrink-0 p-0 hover:bg-muted"
                onClick={() => onOpenChange(false)}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">{activeViewChild}</div>
        </div>
      </StackMenuContext.Provider>
    );

    if (asDropdown && trigger) {
      return (
        <DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            align={align}
            className="w-auto p-0"
            onFocusOutside={(e) => {
              const target = e.target as HTMLElement | null;
              if (
                target?.closest('[data-slot="popover-content"]') ||
                target?.closest('[data-slot="dropdown-menu-content"]') ||
                target?.closest('[data-slot="command-list"]')
              ) {
                e.preventDefault();
              }
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement | null;
              // Keep the menu open when interacting with nested popovers or dropdowns
              if (
                target?.closest('[data-slot="popover-content"]') ||
                target?.closest('[data-slot="dropdown-menu-content"]') ||
                target?.closest('[data-slot="command-list"]')
              ) {
                e.preventDefault();
              }
            }}
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement | null;
              if (
                target?.closest('[data-slot="popover-content"]') ||
                target?.closest('[data-slot="dropdown-menu-content"]') ||
                target?.closest('[data-slot="command-list"]')
              ) {
                e.preventDefault();
              }
            }}
            sideOffset={sideOffset}
          >
            {menuContent}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return menuContent;
  }
);
StackMenu.displayName = "StackMenu";

// Simplified content component
const StackMenuContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn("p-3", className)} ref={ref} {...props} />
));
StackMenuContent.displayName = "StackMenuContent";

// Section component for grouping
const StackMenuSection = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    title?: string;
  }
>(({ className, title, children, ...props }, ref) => (
  <div className={cn("space-y-2", className)} ref={ref} {...props}>
    {title && (
      <div className="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {title}
      </div>
    )}
    <div className="space-y-1">{children}</div>
  </div>
));
StackMenuSection.displayName = "StackMenuSection";

// Clean menu item component
interface StackMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  endIcon?: ReactNode;
  description?: string;
  navigateTo?: string;
  navigateTitle?: string;
}

const StackMenuItem = forwardRef<HTMLButtonElement, StackMenuItemProps>(
  (
    {
      className,
      icon,
      endIcon,
      children,
      description,
      navigateTo,
      navigateTitle,
      onClick,
      ...props
    },
    ref
  ) => {
    const { navigate } = useStackMenu();

    const handleClick = useCallback(
      (e: MouseEvent<HTMLButtonElement>) => {
        if (navigateTo) {
          navigate(navigateTo, navigateTitle);
        }
        onClick?.(e);
      },
      [navigate, navigateTo, navigateTitle, onClick]
    );

    return (
      <Button
        className={cn(
          "h-auto w-full justify-start gap-3 p-2 text-left font-normal hover:bg-accent",
          className
        )}
        onClick={handleClick}
        ref={ref}
        variant="ghost"
        {...props}
      >
        {icon && (
          <div className="flex h-5 w-5 items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-foreground text-sm">{children}</div>
          {description && (
            <div className="mt-0.5 truncate text-muted-foreground text-xs">
              {description}
            </div>
          )}
        </div>
        {/* Trailing slot with fixed width to avoid layout shift when a badge appears */}
        <div className="ml-1 flex w-8 flex-shrink-0 items-center justify-end">
          {endIcon ? (
            <div className="text-muted-foreground">{endIcon}</div>
          ) : (
            navigateTo && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </div>
      </Button>
    );
  }
);
StackMenuItem.displayName = "StackMenuItem";

// Separator component
const StackMenuSeparator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn("my-2 h-px bg-border", className)} ref={ref} {...props} />
));
StackMenuSeparator.displayName = "StackMenuSeparator";

export {
  StackMenu,
  StackMenuContent,
  StackMenuSection,
  StackMenuItem,
  StackMenuSeparator,
  StackMenuView,
  useStackMenu,
};
