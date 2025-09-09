import type React from 'react';
import InlineSVG from 'react-inlinesvg';
import { twMerge } from 'tailwind-merge';

const TITLE_TAG_REGEX = /<title[\s\S]*?>[\s\S]*?<\/title>/;
const OPENING_SVG_TAG_REGEX = /<svg([^>]*)>/;

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
        if (!alt) {
          return code;
        }
        const hasTitle = TITLE_TAG_REGEX.test(code);
        if (hasTitle) {
          return code;
        }
        return code.replace(OPENING_SVG_TAG_REGEX, `<svg$1><title>${alt}</title>`);
      }}
      role="img"
      src={src}
    />
  );
};

export { SVG };
