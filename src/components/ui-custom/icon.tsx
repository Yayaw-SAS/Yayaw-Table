import type { LucideProps } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'motion/react';
import type { FC, HTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

type IconSize = '2xl' | '3xl' | 'lg' | 'md' | 'sm' | 'xl' | 'xs';

const sizeMap: Record<IconSize, number> = {
  '2xl': 40,
  '3xl': 48,
  lg: 24,
  md: 20,
  sm: 16,
  xl: 32,
  xs: 12,
};

interface IconProps extends HTMLAttributes<HTMLDivElement> {
  animated?: boolean; // Option to enable/disable animation
  className?: string;
  name: string;
  size?: IconSize | number;
  strokeWidth?: number;
}

export function getLucideIcon(iconName: string): null | FC<LucideProps> {
  return (
    (LucideIcons as unknown as Record<string, FC<LucideProps>>)[iconName] ||
    null
  );
}

/**
 * Icon component that renders a Lucide icon by name or the brand icon
 * Uses cn utility for class name merging
 * Supports predefined size variants or custom size
 * Special case: when name="brand", it displays the site's SVG icon
 *
 * @example
 * <Icon name="Check" className="text-green-500" size="lg" />
 * <Icon name="ArrowRight" size="sm" className="ml-2" />
 * <Icon name="Bell" size={36} strokeWidth={1.5} />
 * <Icon name="brand" className="h-6 w-6" />
 */
export function Icon({
  animated = true, // Animation enabled by default
  className,
  name,
  size = 'md',
  strokeWidth = 2,
  ...props
}: IconProps): ReactElement {
  const IconComponent = getLucideIcon(name);

  // Determine icon size
  let iconSize: number;
  if (typeof size === 'number') {
    // If size is a number, use it directly
    iconSize = size;
  } else if (size in sizeMap) {
    // If size is a string matching a predefined size, use the corresponding number
    iconSize = sizeMap[size];
  } else {
    // Fallback to medium size
    iconSize = sizeMap.md;
  }

  if (!IconComponent) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-card-foreground',
          className
        )}
        {...props}
      />
    );
  }

  // Animation variants for the icon container
  const iconVariants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
  };

  // Use the regular IconComponent, we'll wrap it with motion.div instead
  const IconComp = IconComponent;

  if (animated) {
    // Use motion.div for animated icons with explicit type casting to avoid conflicts
    return (
      <motion.div
        className={cn(
          'flex items-center justify-center text-card-foreground',
          className
        )}
        initial="initial"
        variants={iconVariants}
        whileHover="hover"
      >
        <IconComp size={iconSize} stroke="currentColor" strokeWidth={1.5} />
      </motion.div>
    );
  }

  // Use regular div for non-animated icons
  return (
    <div
      className={cn(
        'flex items-center justify-center text-card-foreground',
        className
      )}
      {...props}
    >
      <IconComp
        size={iconSize}
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </div>
  );
}
