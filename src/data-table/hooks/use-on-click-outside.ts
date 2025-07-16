import { type RefObject, useEffect } from 'react'

export function useOnClickOutside(
    refs: RefObject<HTMLElement>[],
    handler: (event: MouseEvent | TouchEvent) => void
) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            // If any ref is undefined or null, return
            if (refs.some((ref) => !ref.current)) {
                return
            }

            // Check if click was outside all refs
            const clickedOutside = refs.every((ref) => {
                const el = ref.current
                if (!(el && event.target instanceof Node)) {
                    return true
                }
                return !el.contains(event.target)
            })

            if (clickedOutside) {
                handler(event)
            }
        }

        document.addEventListener('mousedown', listener)
        document.addEventListener('touchstart', listener)

        return () => {
            document.removeEventListener('mousedown', listener)
            document.removeEventListener('touchstart', listener)
        }
    }, [refs, handler])
}
