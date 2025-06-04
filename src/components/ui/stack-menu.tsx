"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X, ArrowLeft, SlidersHorizontal } from "lucide-react";

import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface StackMenuViewProps {
  children: React.ReactNode;
  name: string;
}

const StackMenuContext = React.createContext<{
  activeView: string;
  direction: "forward" | "backward";
  goBack: () => void;
  navigate: (view: string) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  views: Record<string, React.ReactNode>;
  defaultView: string;
}>({
  activeView: "main",
  direction: "forward",
  goBack: () => {},
  navigate: () => {},
  onOpenChange: undefined,
  open: false,
  views: {},
  defaultView: "main",
});

const useStackMenu = () => {
  return React.useContext(StackMenuContext);
};

const stackMenuVariants = cva("flex flex-col w-full", {
  variants: {
    variant: {
      default: "bg-popover",
      ghost: "bg-background",
    },
    size: {
      default: "w-[300px]",
      sm: "w-[280px]",
      lg: "w-[560px]",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

interface StackMenuProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackMenuVariants> {
  defaultView?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  asDropdown?: boolean;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const StackMenuView = ({ children, name }: StackMenuViewProps) => {
  return (
    <div className="w-full flex-shrink-0" data-view-name={name}>
      {children}
    </div>
  );
};
StackMenuView.displayName = "StackMenuView";

const StackMenu = React.forwardRef<HTMLDivElement, StackMenuProps>(
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
      ...props
    },
    ref,
  ) => {
    const [activeView, setActiveView] = React.useState(defaultView);
    const [direction, setDirection] = React.useState<"forward" | "backward">(
      "forward",
    );
    const [viewHistory, setViewHistory] = React.useState<string[]>([
      defaultView,
    ]);
    const [isOpen, setIsOpen] = React.useState(open || false);
    const [isTransitioning, setIsTransitioning] = React.useState(false);

    const navigate = React.useCallback((view: string) => {
      setDirection("forward");
      setIsTransitioning(true);
      setActiveView(view);
      setViewHistory((prev) => [...prev, view]);
    }, []);

    const goBack = React.useCallback(() => {
      if (viewHistory.length > 1) {
        setDirection("backward");
        setIsTransitioning(true);
        const newHistory = [...viewHistory];
        newHistory.pop();
        const previousView = newHistory[newHistory.length - 1];
        setActiveView(previousView);
        setViewHistory(newHistory);
      }
    }, [viewHistory]);

    const handleOpenChange = React.useCallback(
      (state: boolean) => {
        setIsOpen(state);
        onOpenChange?.(state);

        if (!state) {
          setActiveView(defaultView);
          setViewHistory([defaultView]);
          setDirection("forward");
        }
      },
      [defaultView, onOpenChange],
    );

    React.useEffect(() => {
      if (open !== undefined && open !== isOpen) {
        setIsOpen(open);
      }
    }, [open, isOpen]);

    // Handle transition end
    const handleTransitionEnd = React.useCallback(() => {
      setIsTransitioning(false);
    }, []);

    // Filter children to separate views from other elements
    const viewChildren = React.Children.toArray(children).filter(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type === "function" &&
        (child.type as any).displayName === "StackMenuView",
    );

    const headerChildren = React.Children.toArray(children).filter(
      (child) =>
        !React.isValidElement(child) ||
        typeof child.type !== "function" ||
        (child.type as any).displayName !== "StackMenuView",
    );

    const menuContent = (
      <StackMenuContext.Provider
        value={{
          activeView,
          direction,
          goBack,
          navigate,
          views: {},
          open: isOpen,
          onOpenChange: handleOpenChange,
          defaultView,
        }}
      >
        <div
          ref={ref}
          className={cn(stackMenuVariants({ variant, size }), className)}
          {...props}
        >
          {/* Header section */}
          {headerChildren}

          {/* Views section */}
          <div className="flex-1 overflow-hidden">
            <div
              className={cn(
                "flex w-full transition-transform duration-200 ease-in-out",
                isTransitioning &&
                  (direction === "forward"
                    ? "-translate-x-[100%]"
                    : "translate-x-[100%]"),
              )}
              onTransitionEnd={handleTransitionEnd}
            >
              {viewChildren.map((child) => {
                if (React.isValidElement(child)) {
                  const childProps = child.props as StackMenuViewProps;
                  const viewName = childProps.name;
                  const isActive = viewName === activeView;

                  return (
                    <div
                      key={viewName}
                      className={cn(
                        "min-w-full flex-shrink-0",
                        !isActive && "hidden",
                      )}
                    >
                      {child}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </StackMenuContext.Provider>
    );

    if (asDropdown && trigger) {
      return (
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="p-0"
            align={align}
            sideOffset={sideOffset}
          >
            {menuContent}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return menuContent;
  },
);
StackMenu.displayName = "StackMenu";

const stackMenuHeaderVariants = cva(
  "flex items-center gap-2 p-2 border-b shrink-0",
  {
    variants: {
      variant: {
        default: "border-border",
        ghost: "border-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StackMenuHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackMenuHeaderVariants> {
  showBackButton?: boolean;
}

const StackMenuHeader = React.forwardRef<HTMLDivElement, StackMenuHeaderProps>(
  ({ className, variant, children, ...props }, ref) => {
    const { activeView, defaultView, goBack, onOpenChange } = useStackMenu();
    const isMainView = activeView === defaultView;

    return (
      <div
        ref={ref}
        className={cn(stackMenuHeaderVariants({ variant }), className)}
        {...props}
      >
        {!isMainView && (
          <Button
            className="h-8 w-8 p-0"
            onClick={goBack}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">{children}</div>
        {onOpenChange && (
          <Button
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  },
);
StackMenuHeader.displayName = "StackMenuHeader";

const stackMenuTitleVariants = cva(
  "p-1 flex items-center gap-2 text-sm font-semibold",
  {
    variants: {
      variant: {
        default: "text-foreground",
        ghost: "text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StackMenuTitleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackMenuTitleVariants> {}

const StackMenuTitle = React.forwardRef<HTMLDivElement, StackMenuTitleProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(stackMenuTitleVariants({ variant }), className)}
      {...props}
    />
  ),
);
StackMenuTitle.displayName = "StackMenuTitle";

const stackMenuContentVariants = cva("p-2", {
  variants: {
    variant: {
      default: "",
      ghost: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface StackMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackMenuContentVariants> {}

const StackMenuContent = React.forwardRef<
  HTMLDivElement,
  StackMenuContentProps
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(stackMenuContentVariants({ variant }), className)}
    {...props}
  />
));
StackMenuContent.displayName = "StackMenuContent";

const stackMenuItemVariants = cva(
  "w-full p-2 flex items-center justify-start gap-2 rounded-md transition-colors",
  {
    variants: {
      variant: {
        default: "hover:bg-accent",
        ghost: "hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StackMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof stackMenuItemVariants> {
  icon?: React.ReactNode;
  endIcon?: React.ReactNode;
  description?: string;
  navigateTo?: string;
}

const StackMenuItem = React.forwardRef<HTMLButtonElement, StackMenuItemProps>(
  (
    {
      className,
      variant,
      icon,
      endIcon,
      children,
      description,
      navigateTo,
      onClick,
      ...props
    },
    ref,
  ) => {
    const { navigate } = useStackMenu();

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (navigateTo) {
          navigate(navigateTo);
        }
        onClick?.(e);
      },
      [navigate, navigateTo, onClick],
    );

    return (
      <Button
        ref={ref}
        className={cn(stackMenuItemVariants({ variant }), className)}
        onClick={handleClick}
        {...props}
        variant="ghost"
      >
        {icon && (
          <div className="p-1 rounded flex items-center justify-center size-8">
            {icon}
          </div>
        )}
        <span className="flex text-sm">{children}</span>
        {description && (
          <span className="ml-auto text-muted-foreground text-sm">
            {description}
          </span>
        )}
        {navigateTo && !endIcon && (
          <span className="text-muted-foreground text-sm ml-auto">{">"}</span>
        )}
        {endIcon && (
          <span className="text-muted-foreground text-sm">{endIcon}</span>
        )}
      </Button>
    );
  },
);
StackMenuItem.displayName = "StackMenuItem";

const stackMenuBackButtonVariants = cva(
  "flex items-center gap-2 transition-colors",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-foreground",
        ghost: "text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StackMenuBackButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof stackMenuBackButtonVariants> {
  icon?: React.ReactNode;
}

const StackMenuBackButton = React.forwardRef<
  HTMLButtonElement,
  StackMenuBackButtonProps
>(({ className, variant, icon, children, onClick, ...props }, ref) => {
  const { goBack } = useStackMenu();

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      goBack();
      onClick?.(e);
    },
    [goBack, onClick],
  );

  return (
    <Button
      ref={ref}
      className={cn(stackMenuBackButtonVariants({ variant }), className)}
      onClick={handleClick}
      {...props}
      variant="ghost"
      size="icon"
    >
      {icon}
    </Button>
  );
});
StackMenuBackButton.displayName = "StackMenuBackButton";

export {
  StackMenu,
  StackMenuHeader,
  StackMenuTitle,
  StackMenuContent,
  StackMenuItem,
  StackMenuBackButton,
  StackMenuView,
  useStackMenu,
};
