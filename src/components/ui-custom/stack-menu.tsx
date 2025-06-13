"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X, ArrowLeft, ChevronRight } from "lucide-react";

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
  title?: string;
}

const StackMenuContext = React.createContext<{
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
  navigate: () => {},
  goBack: () => {},
  onOpenChange: undefined,
  open: false,
  defaultView: "main",
  viewHistory: [],
  canGoBack: false,
});

const useStackMenu = () => {
  return React.useContext(StackMenuContext);
};

const stackMenuVariants = cva("flex flex-col bg-background border rounded-lg shadow-lg", {
  variants: {
    variant: {
      default: "bg-popover border-border",
      ghost: "bg-background border-muted",
    },
    size: {
      default: "w-[320px] max-h-[500px]",
      sm: "w-[280px] max-h-[400px]",
      lg: "w-[400px] max-h-[600px]",
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

const StackMenuView = ({ children, name, title }: StackMenuViewProps) => {
  return (
    <div className="w-full h-full flex flex-col" data-view-name={name}>
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
    const [viewHistory, setViewHistory] = React.useState<Array<{ name: string; title?: string }>>([
      { name: defaultView }
    ]);
    const [isOpen, setIsOpen] = React.useState(open || false);

    const navigate = React.useCallback((view: string, title?: string) => {
      setActiveView(view);
      setViewHistory((prev) => [...prev, { name: view, title }]);
    }, []);

    const goBack = React.useCallback(() => {
      if (viewHistory.length > 1) {
        const newHistory = [...viewHistory];
        newHistory.pop();
        const previousView = newHistory[newHistory.length - 1];
        setActiveView(previousView.name);
        setViewHistory(newHistory);
      }
    }, [viewHistory]);

    const canGoBack = viewHistory.length > 1;

    const handleOpenChange = React.useCallback(
      (state: boolean) => {
        setIsOpen(state);
        onOpenChange?.(state);

        if (!state) {
          // Reset to default view when closing
          setActiveView(defaultView);
          setViewHistory([{ name: defaultView }]);
        }
      },
      [defaultView, onOpenChange],
    );

    React.useEffect(() => {
      if (open !== undefined && open !== isOpen) {
        setIsOpen(open);
      }
    }, [open, isOpen]);

    // Get all views
    const viewChildren = React.Children.toArray(children).filter(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type === "function" &&
        (child.type as any).displayName === "StackMenuView",
    );

    // Find the active view
    const activeViewChild = viewChildren.find((child) => {
      if (React.isValidElement(child)) {
        const childProps = child.props as StackMenuViewProps;
        return childProps.name === activeView;
      }
      return false;
    });

    // Get current view title
    const currentViewTitle = viewHistory[viewHistory.length - 1]?.title;

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
          ref={ref}
          className={cn(stackMenuVariants({ variant, size }), className)}
          {...props}
        >
          {/* Header with navigation */}
          <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
            {canGoBack && (
              <Button
                size="sm"
                variant="ghost"
                onClick={goBack}
                className="h-7 w-7 p-0 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1 font-medium text-sm text-foreground">
              {currentViewTitle || (activeView === defaultView ? "Menu" : activeView)}
            </div>
            {onOpenChange && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 p-0 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeViewChild}
          </div>
        </div>
      </StackMenuContext.Provider>
    );

    if (asDropdown && trigger) {
      return (
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="p-0 w-auto"
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

// Simplified content component
const StackMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-3", className)}
    {...props}
  />
));
StackMenuContent.displayName = "StackMenuContent";

// Section component for grouping
const StackMenuSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
  }
>(({ className, title, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-2", className)}
    {...props}
  >
    {title && (
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
    )}
    <div className="space-y-1">
      {children}
    </div>
  </div>
));
StackMenuSection.displayName = "StackMenuSection";

// Clean menu item component
interface StackMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  endIcon?: React.ReactNode;
  description?: string;
  navigateTo?: string;
  navigateTitle?: string;
}

const StackMenuItem = React.forwardRef<HTMLButtonElement, StackMenuItemProps>(
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
    ref,
  ) => {
    const { navigate } = useStackMenu();

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (navigateTo) {
          navigate(navigateTo, navigateTitle);
        }
        onClick?.(e);
      },
      [navigate, navigateTo, navigateTitle, onClick],
    );

    return (
      <Button
        ref={ref}
        className={cn(
          "w-full h-auto p-2 justify-start gap-3 hover:bg-accent text-left font-normal",
          className
        )}
        onClick={handleClick}
        variant="ghost"
        {...props}
      >
        {icon && (
          <div className="flex items-center justify-center w-5 h-5 text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground truncate">{children}</div>
          {description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {description}
            </div>
          )}
        </div>
        {navigateTo && !endIcon && (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        {endIcon && (
          <div className="flex-shrink-0 text-muted-foreground">
            {endIcon}
          </div>
        )}
      </Button>
    );
  },
);
StackMenuItem.displayName = "StackMenuItem";

// Separator component
const StackMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("h-px bg-border my-2", className)}
    {...props}
  />
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
