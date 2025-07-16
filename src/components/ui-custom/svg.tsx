import type React from 'react'
import InlineSVG from 'react-inlinesvg'
import { twMerge } from 'tailwind-merge'

interface SvgProps {
    alt?: string
    className?: string
    src: string
}

const SVG: React.FC<SvgProps> = ({ alt, className, src }) => {
    return (
        <InlineSVG aria-label={alt} cacheRequests={true} className={twMerge(className)} src={src} />
    )
}

export { SVG }
