import { cn } from '../../lib/utils';
import { SVG } from './svg';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <SVG
      alt={`${'YaYaw Table'} logo`}
      className={cn(className)}
      src={'/logo.svg'}
    />
  );
}
