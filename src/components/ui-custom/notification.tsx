import { DescriptionNotification } from "@/components/style/description-notification"
import { TitleNotification } from "@/components/style/title-notification"
import { AlertCircle, Clipboard, Hourglass, LucideGamepad2, MailCheck, PlugZap } from "lucide-react"
import Link from "next/link"

import type { NotificationProps } from "@/types/index"
import type React from "react"

const variantMap = {
    copy: { color: "stroke-green-500", icon: Clipboard },
    disconnect: { color: "stroke-orange-500", icon: PlugZap },
    email: { color: "stroke-green-500", icon: MailCheck },
    error: { color: "stroke-red-500", icon: AlertCircle },
    gamepad: { color: "stroke-primary", icon: LucideGamepad2 },
    time: { color: "stroke-foreground", icon: Hourglass },
    warning: { color: "stroke-destructive", icon: AlertCircle }
}

const Notification: React.FC<NotificationProps> = ({
    actionLink,
    actionText,
    code,
    description,
    onClick,
    title,
    variant
}) => {
    const { color, icon: Icon } = variantMap[variant as keyof typeof variantMap]

    return (
        <div className="items-left my-2 flex w-auto">
            <div className="justify-left flex items-center">
                <Icon className={`${color} h-6 w-6 shrink-0`} />
                <div className="ml-4 flex flex-col justify-center">
                    {code || title ? (
                        <TitleNotification>
                            {code ? `${code} - ` : ""}
                            {title}
                        </TitleNotification>
                    ) : null}
                    {description && (
                        <DescriptionNotification>{description}</DescriptionNotification>
                    )}
                </div>
                {(actionLink || onClick) && (
                    <div className="ml-auto">
                        {actionLink && (
                            <Link
                                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                                href={actionLink}
                            >
                                {actionText}
                            </Link>
                        )}
                        {onClick && (
                            <button
                                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                                onClick={onClick}
                                type="button"
                            >
                                {actionText}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export { Notification }
