import type React from 'react';
import InlineSVG from 'react-inlinesvg';
import { twMerge } from 'tailwind-merge';

interface SvgProps {
  alt?: string;
  className?: string;
  src: string;
}

const SVG: React.FC<SvgProps> = ({ alt, className, src }) => {
  return (
    <InlineSVG
      aria-label={alt}
      cacheRequests={true}
      className={twMerge(className)}
      preProcessor={(code) => {
        if (!alt) return code;
        const hasTitle = /<title[\s\S]*?>[\s\S]*?<\/title>/.test(code);
        if (hasTitle) return code;
        return code.replace(/<svg([^>]*)>/, '<svg$1><title>' + alt + '</title>');
      }}
      role="img"
      src={src}
    />
  );
};

export { SVG };
