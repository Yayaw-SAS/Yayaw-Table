import { cn } from '@/lib/utils'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const Container = ({ children, className, ...props }: ContainerProps) => {
    return (
        <div
            className={cn(
                'container mx-auto flex h-full items-center justify-center p-4',
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}

export { Container }
